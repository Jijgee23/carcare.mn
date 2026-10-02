/** HUR-аас ирсэн алдааны текстийн үгийн алдааг засч хэрэглэгчид харуулна. */
export function hurUserMessage(msg: string): string {
  return msg.replace(/төв\s*-с/g, "төвөөс");
}
