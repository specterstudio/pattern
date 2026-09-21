import { writeFileSync } from "node:fs";

import { renderToStaticMarkup } from "react-dom/server";

import { PatternIcon } from "../src/components/PatternIcon";

const previewItems = [
  { name: "arrow-right", size: 16, color: "#0D0D0D" },
  { name: "check", size: 24, color: "#006DFF" },
  { name: "heart", size: 32, color: "#E33B3B" },
  { name: "sparkles", size: 48, color: "#7450E8" },
  { name: "shopping-cart", size: 24, color: "#147A55" },
  { name: "globe", size: 32, color: "#D66A00" },
] as const;

const cards = previewItems
  .map(
    ({ name, size, color }) => `
      <article class="card">
        <div class="icon-stage">${renderToStaticMarkup(
          <PatternIcon name={name} size={size} color={color} label={name} />,
        )}</div>
        <strong>${name}</strong>
        <span>${size}px · ${color}</span>
      </article>`,
  )
  .join("");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Pattern Icon preview</title>
    <style>
      * { box-sizing: border-box; }
      body {
        margin: 0;
        padding: 48px;
        color: #0d0d0d;
        background: #fcf6f3;
        font: 14px/1.4 Inter, Arial, sans-serif;
      }
      h1 { margin: 0 0 8px; font-size: 30px; letter-spacing: -0.03em; }
      p { margin: 0 0 32px; color: #635e5a; }
      .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
      .card {
        min-height: 180px;
        padding: 20px;
        border: 1px solid #ded7d2;
        border-radius: 12px;
        background: #fff;
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .icon-stage {
        height: 96px;
        margin-bottom: 10px;
        border-radius: 8px;
        background: #f8f4f1;
        display: grid;
        place-items: center;
      }
      article > span { color: #746e69; font-size: 12px; }
    </style>
  </head>
  <body>
    <h1>Pattern Icon</h1>
    <p>Representative Figma exports rendered at configurable sizes and colors.</p>
    <main class="grid">${cards}</main>
  </body>
</html>`;

const outputPath = "/tmp/pattern-icon-preview.html";
writeFileSync(outputPath, html);
console.log(outputPath);
