import {chromium} from "playwright";
import {mkdirSync} from "node:fs";
const out="artifacts/real-deal-chord-chart";
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:out,size:{width:390,height:844}}});
const page=await context.newPage();
const source="https://hopamviet.vn/chord/song/de-nho-mot-thoi-ta-da-yeu/W8IU0FEO.html";
try{
 const response=await page.goto("http://127.0.0.1:5173/chord-chart?url="+encodeURIComponent(source),{waitUntil:"domcontentloaded",timeout:45000});
 if(!response?.ok())throw new Error("Chord chart HTTP "+response?.status());
 await page.locator("[data-testid='abcjs-chord-chart'] svg").first().waitFor({timeout:60000,state:"visible"});
 const svgText=await page.locator("[data-testid='abcjs-chord-chart'] svg").first().textContent();
 const lyricText=await page.getByTestId("song-lyrics").innerText();
 if(!svgText.includes("Am"))throw new Error("Rendered ABCJS SVG lacks source chord Am");
 if(!lyricText.includes("Hạnh phúc"))throw new Error("Real user-supplied song lyrics were not loaded");
 await page.screenshot({path:out+"/chord-chart.png",fullPage:true});
 console.log("PASS: true song data, ABCJS Am chord, original lyrics. Video recorded.");
}finally{await context.close();await browser.close()}
