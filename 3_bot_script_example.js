import { relayInit } from "nostr-tools";
import { upsertTableOrCreate, getSingle } from "nostr-key-value";
import dotenv from "dotenv";
import { postNostr, currUnixtime } from "./util/util.js";

dotenv.config();

// 必要な設定をしていきます。
const relayUrl = "wss://relay-jp.nostr.wirednet.jp";
const nsec = process.env.NSEC;
const npub = process.env.NPUB;
const tableName = "home_system";
const tableTitle = "home_system";

// Nostr 投稿文言作成
const send = (content, targetEvent = null) => {
  const created = targetEvent ? targetEvent.created_at + 1 : currUnixtime();
  const ev = {
    kind: 42,
    content: content,
    tags: targetEvent.tags,
    created_at: created,
  };
  if (targetEvent) {
    ev.tags.push(["e", targetEvent.id, "", "reply"]);
    ev.tags.push(["p", targetEvent.pubkey]);
  }
  postNostr(ev, nsec, relayUrl);
};

// メイン関数
const main = async () => {
  const relay = relayInit(relayUrl);
  relay.on("error", () => {
    throw "failed to connnect";
  });

  await relay.connect();
  const sub = relay.sub([
     //{ kinds: [42], "#p": [npub], since: currUnixtime() - 60 },
    { kinds: [42], since: currUnixtime() },
  ]);

  // リプライ返信
  sub.on("event", async (ev) => {
    if (ev.content.match(/^扉の状態は？$/i)) {
      // 扉の状態を取得して、返事する処理
      const single = await getSingle([relayUrl], npub, tableName, "door_status");
      const result = single ?? "知らんがな"
      send(result, ev);
    }
    if (ev.content.match(/^開けて$/i)) {
      // 扉を開けて、状態をDBに保存する処理
      const values = [["door_status", "開いてとるで"]];
      const table_ev = await upsertTableOrCreate(
        [relayUrl],
        npub,
        tableName,
        tableTitle,
        [],
        values
      );
      postNostr(table_ev, nsec, relayUrl);
      send("開けたで", ev);
    }
    if (ev.content.match(/^閉めて$/i)) {
      // 扉を閉めて、状態をDBに保存する処理
      const values = [["door_status", "閉まっとるで"]];
      const table_ev = await upsertTableOrCreate(
        [relayUrl],
        npub,
        tableName,
        tableTitle,
        [],
        values
      );
      postNostr(table_ev, nsec, relayUrl);
      send("閉めたで", ev);
    }
    if (ev.content.match(/^光あれ$/i)) {
      send("光無いで", ev);
    }
  });
};

main().catch((e) => console.error(e));
