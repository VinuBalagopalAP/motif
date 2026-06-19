import * as cheerio from "cheerio";

export async function scrapeSite(url: string) {
  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const html = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; UGCBot/1.0)'
      },
      signal: controller.signal
    }).then(r => r.text());
    
    clearTimeout(timeoutId);
    
    const $ = cheerio.load(html);

    return {
      title: $("title").text().trim(),
      description: $('meta[name="description"]').attr("content") || "",
      headings: $("h1, h2").map((_, el) => $(el).text().trim()).get().slice(0, 5),
      bodyText: $("body").text().replace(/\s+/g, " ").slice(0, 1000),
    };
  } catch (error) {
    console.error("Failed to scrape site:", error);
    return { title: "", description: "", headings: [], bodyText: "" };
  }
}
