// Pretty startup banner utility for Node / NestJS
// Auto-wraps text, prevents negative padding, supports emojis

export interface BannerSection {
  label?: string;
  value?: string;
  raw?: string; // prints raw line without formatting
}

export function createBanner(title: string, sections: BannerSection[], width = 70): string {
  const innerWidth = width - 2; // inside box without borders

  const wrapText = (text: string) => {
    const result: string[] = [];
    while (text.length > innerWidth) {
      result.push(text.slice(0, innerWidth));
      text = text.slice(innerWidth);
    }
    result.push(text);
    return result;
  };

  const line: any = (text = "") => {
    if (text.length > innerWidth) return wrapText(text).map(line).join("\n");
    const pad = innerWidth - text.length;
    return `║ ${text}${" ".repeat(Math.max(0, pad - 1))}║`;
  };

  let output = [
    `╔${"═".repeat(innerWidth)}╗`,
    line(),
    line(`🚀 ${title}`),
    line(),
    `╠${"═".repeat(innerWidth)}╣`,
  ];

  for (const sec of sections) {
    if (sec.raw) {
      output.push(line(sec.raw));
      continue;
    }
    if (sec.label && sec.value) output.push(line(`${sec.label}: ${sec.value}`));
    else if (sec.label) output.push(line(sec.label));
    else if (sec.value) output.push(line(sec.value));
  }

  output.push(`╚${"═".repeat(innerWidth)}╝`);
  return output.join("\n");
}
