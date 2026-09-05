import fs from "node:fs/promises";
import path from "node:path";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const ROOT = "D:/GitHub/Magic-Trip-Planner-Idealize";
const TMP = `${ROOT}/tmp/idealize_deck`;
const FINAL = `${ROOT}/output/presentation/Magic_Trip_Planner_IDEALIZE_2026_Semi_Final.pptx`;
const W = 1280;
const H = 720;

const C = {
  white: "#FFFFFF",
  canvas: "#FFFDF8",
  ink: "#143A31",
  black: "#111111",
  muted: "#61766F",
  rule: "#C8D2CD",
  panel: "#EEF2EF",
  panelWarm: "#F7F2EA",
  green: "#0D4A3B",
  green2: "#1A6653",
  greenSoft: "#DCEBE4",
  orange: "#D96B32",
  orangeSoft: "#F8E1D5",
  blue: "#3D8DFF",
};

const presentation = Presentation.create({ slideSize: { width: W, height: H } });

function addText(slide, text, left, top, width, height, options = {}) {
  const shape = slide.shapes.add({
    geometry: "textbox",
    name: options.name || `text-${Math.round(left)}-${Math.round(top)}`,
    position: { left, top, width, height },
    fill: "none",
    line: { style: "solid", fill: "none", width: 0 },
  });
  shape.text = text;
  shape.text.style = {
    fontSize: options.fontSize ?? 18,
    typeface: options.typeface || "Arial",
    color: options.color || C.ink,
    bold: options.bold ?? false,
    alignment: options.alignment || "left",
    verticalAlignment: options.verticalAlignment || "top",
    autoFit: options.autoFit || "shrinkText",
  };
  return shape;
}

function addRect(slide, left, top, width, height, fill, options = {}) {
  return slide.shapes.add({
    geometry: options.geometry || "rect",
    name: options.name || `rect-${Math.round(left)}-${Math.round(top)}`,
    position: { left, top, width, height },
    fill,
    line: {
      style: "solid",
      fill: options.lineFill || fill,
      width: options.lineWidth ?? 0,
    },
    ...(options.borderRadius ? { borderRadius: options.borderRadius } : {}),
  });
}

function addRule(slide, left, top, width, color = C.rule, height = 2) {
  return addRect(slide, left, top, width, height, color, { name: `rule-${Math.round(top)}` });
}

function addHeader(slide, section, title, number) {
  addText(slide, section.toUpperCase(), 48, 30, 430, 28, {
    fontSize: 15,
    color: C.orange,
    bold: true,
    name: `section-${number}`,
  });
  addText(slide, title, 48, 68, 1178, 80, {
    fontSize: 40,
    color: C.ink,
    bold: true,
    name: `title-${number}`,
  });
  addRule(slide, 48, 152, 1184, C.rule, 1);
  addText(slide, String(number).padStart(2, "0"), 1182, 674, 50, 20, {
    fontSize: 13,
    color: C.muted,
    alignment: "right",
    name: `slide-number-${number}`,
  });
}

function addLabel(slide, text, left, top, width, color = C.orange) {
  addText(slide, text.toUpperCase(), left, top, width, 24, {
    fontSize: 14,
    color,
    bold: true,
  });
}

async function addImage(slide, imagePath, position, alt, options = {}) {
  const bytes = await fs.readFile(imagePath);
  const ext = path.extname(imagePath).toLowerCase();
  const contentType = ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "image/png";
  return slide.images.add({
    blob: bytes,
    contentType,
    alt,
    fit: options.fit || "cover",
    position,
    ...(options.crop ? { crop: options.crop } : {}),
    ...(options.geometry ? { geometry: options.geometry } : {}),
    ...(options.borderRadius ? { borderRadius: options.borderRadius } : {}),
  });
}

function addNotes(slide, presenter, sources) {
  const note = `${presenter}\n\n[Sources]\n${sources.map((s) => `- ${s}`).join("\n")}\n[/Sources]`;
  slide.speakerNotes.textFrame.setText(note);
}

// Slide 1 - cover (Codex Grid cover-image-field silhouette)
{
  const slide = presentation.slides.add();
  slide.background.fill = C.green;
  addRect(slide, 650, 0, 630, 720, C.canvas, { name: "cover-image-backing" });
  await addImage(
    slide,
    `${TMP}/product-login-focus.png`,
    { left: 650, top: 0, width: 630, height: 720 },
    "Implemented Magic Trip Planner sign-in experience",
    { fit: "contain" },
  );
  addRect(slide, 624, 0, 26, 720, C.orange);
  addText(slide, "IDEALIZE 2026  /  SEMI-FINALS", 54, 50, 510, 34, {
    fontSize: 17,
    color: C.orangeSoft,
    bold: true,
    name: "cover-kicker",
  });
  addText(slide, "Magic Trip\nPlanner", 54, 142, 520, 180, {
    fontSize: 66,
    color: C.white,
    bold: true,
    autoFit: "none",
    name: "cover-title",
  });
  addText(slide, "Less planning.\nMore going.", 54, 366, 500, 106, {
    fontSize: 38,
    color: C.greenSoft,
    bold: false,
    name: "cover-tagline",
  });
  addText(slide, "AI-assisted Sri Lanka itineraries that connect places, routes, stays, and costs in one restorable plan.", 54, 520, 520, 86, {
    fontSize: 20,
    color: C.white,
    name: "cover-summary",
  });
  addText(slide, "WEB APPLICATION PITCH DECK", 54, 656, 390, 22, {
    fontSize: 14,
    color: C.orangeSoft,
    bold: true,
  });
  addNotes(slide, "Open with the promise: the product reduces planning effort while increasing confidence that the itinerary works in the real world.", [
    "D:/IDEALIZE 2026 - SEMI FINALS - SUBMISSION GUIDELINES.pdf - pitch deck requirement",
    "Local product capture from http://localhost:3000/login on 2026-09-01",
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - product description",
  ]);
}

// Slide 2 - problem (sparse stacked-text-flow)
{
  const slide = presentation.slides.add();
  slide.background.fill = C.canvas;
  addHeader(slide, "Problem", "Planning a trip still means stitching disconnected decisions together.", 2);
  addText(slide, "Travelers discover places, check routes, compare stays, and estimate costs in separate tools. Each decision can invalidate the next.", 48, 184, 590, 122, {
    fontSize: 27,
    color: C.ink,
    bold: true,
  });
  addRect(slide, 48, 332, 590, 244, C.green, { geometry: "roundRect", borderRadius: 18 });
  addText(slide, "THE CONSEQUENCE", 78, 364, 240, 24, { fontSize: 14, color: C.orangeSoft, bold: true });
  addText(slide, "A plan that looks exciting can still fail on timing, distance, accommodation, or budget.", 78, 412, 506, 120, {
    fontSize: 30,
    color: C.white,
    bold: true,
  });

  const pain = [
    ["01", "Discovery overload", "Attractions and stays are compared without a single trip context."],
    ["02", "Route reality", "Travel time, stop order, and daily hotel endpoints are easy to underestimate."],
    ["03", "Budget uncertainty", "Costs are rarely combined into one Sri Lanka-ready LKR estimate."],
  ];
  pain.forEach((item, i) => {
    const y = 194 + i * 138;
    addText(slide, item[0], 708, y, 64, 52, { fontSize: 34, color: C.orange, bold: true });
    addText(slide, item[1], 798, y, 390, 34, { fontSize: 24, color: C.ink, bold: true });
    addText(slide, item[2], 798, y + 42, 390, 62, { fontSize: 18, color: C.muted });
    if (i < pain.length - 1) addRule(slide, 708, y + 118, 480, C.rule, 1);
  });
  addNotes(slide, "Describe the problem as a chain reaction: a destination choice affects the route, the route affects the stay, and both affect the budget.", [
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - product problem and workflow framing",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Frontend/src/app/page.tsx - user-facing value proposition",
  ]);
}

// Slide 3 - solution with actual product screenshot
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Solution", "One trip record connects every decision from idea to itinerary.", 3);
  addLabel(slide, "Magic Trip Planner", 48, 190, 260);
  addText(slide, "A guided workspace turns traveler inputs into a map-verified, editable plan that can be saved, shared, restored, and exported.", 48, 228, 470, 126, {
    fontSize: 25,
    color: C.ink,
    bold: true,
  });
  const outputs = [
    "AI-matched Sri Lanka destinations",
    "Day-by-day road routes and timing",
    "Daily stays near route endpoints",
    "Practical LKR budget estimates",
    "Share, print, calendar, and offline outputs",
  ];
  outputs.forEach((text, i) => {
    const y = 382 + i * 46;
    addRect(slide, 50, y + 4, 12, 12, C.orange, { geometry: "ellipse" });
    addText(slide, text, 78, y, 432, 30, { fontSize: 18, color: C.ink, bold: i === 3 });
  });
  addRect(slide, 560, 190, 670, 444, C.panel, { geometry: "roundRect", borderRadius: 18, lineFill: C.rule, lineWidth: 1 });
  await addImage(
    slide,
    `${TMP}/product-home-viewport.png`,
    { left: 576, top: 206, width: 638, height: 412 },
    "Implemented Magic Trip Planner homepage showing a six-day Colombo to Ella itinerary preview",
    { fit: "cover", geometry: "roundRect", borderRadius: 14 },
  );
  addNotes(slide, "Move from the promise to the evidence: this is the implemented product interface, not a conceptual mock-up.", [
    "Local product capture from http://localhost:3000 on 2026-09-01",
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - implemented product capabilities",
  ]);
}

// Slide 4 - workflow diagram
{
  const slide = presentation.slides.add();
  slide.background.fill = C.canvas;
  addHeader(slide, "Product flow", "Five connected stages turn preferences into a usable travel plan.", 4);
  addText(slide, "The system combines structured AI output with deterministic routing, pricing, persistence, and provider fallbacks.", 48, 184, 990, 54, {
    fontSize: 22,
    color: C.muted,
  });
  const xs = [50, 294, 538, 782, 1026];
  for (let i = 0; i < xs.length - 1; i += 1) {
    addRect(slide, xs[i] + 184, 370, 54, 28, C.orange, { geometry: "rightArrow", name: `flow-arrow-${i + 1}` });
  }
  const stages = [
    ["01", "Set intent", "Dates, budget, travelers, transport, pace, interests"],
    ["02", "Discover", "Gemini returns schema-validated destination ideas"],
    ["03", "Verify", "Geocoding keeps only map-backed places"],
    ["04", "Build", "Daily road routes and stays are sequenced"],
    ["05", "Complete", "LKR budget, exports, sharing, and versions"],
  ];
  stages.forEach((item, i) => {
    addRect(slide, xs[i], 272, 194, 252, i === 2 ? C.green : C.panel, {
      geometry: "roundRect",
      borderRadius: 14,
      lineFill: i === 2 ? C.green : C.rule,
      lineWidth: 1,
      name: `flow-node-${i + 1}`,
    });
    addText(slide, item[0], xs[i] + 20, 294, 60, 44, { fontSize: 30, color: i === 2 ? C.orangeSoft : C.orange, bold: true });
    addText(slide, item[1], xs[i] + 20, 348, 150, 34, { fontSize: 24, color: i === 2 ? C.white : C.ink, bold: true });
    addText(slide, item[2], xs[i] + 20, 406, 154, 90, { fontSize: 17, color: i === 2 ? C.greenSoft : C.muted });
  });
  addText(slide, "Every stage saves state so the traveler can edit manually, retry, cancel, or restore an earlier plan.", 188, 568, 904, 54, {
    fontSize: 21,
    color: C.ink,
    alignment: "center",
    bold: true,
  });
  addNotes(slide, "Emphasize that AI is used where it adds judgment, while routes, validation, budgets, and orchestration remain explicit application logic.", [
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - How the AI workflow works",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Backend/app/workers/planning_worker.py - durable planning sequence",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Backend/app/agents/route_agent.py - deterministic route planning",
  ]);
}

// Slide 5 - product proof metrics
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Product proof", "The MVP is built for real planning, not a one-shot demo.", 5);
  addText(slide, "The current web application combines guided manual planning with a recoverable one-click workflow.", 48, 182, 1110, 54, {
    fontSize: 22,
    color: C.muted,
  });
  const metrics = [
    ["8", "guided stages", "Preferences through final summary"],
    ["4", "takeaway paths", "Print/PDF, calendar, share, offline HTML"],
    ["2", "collaboration roles", "Viewer and editor access"],
  ];
  metrics.forEach((item, i) => {
    const x = 48 + i * 400;
    addRect(slide, x, 282, 360, 286, i === 0 ? C.green : C.panel, {
      geometry: "roundRect",
      borderRadius: 14,
      lineFill: i === 0 ? C.green : C.rule,
      lineWidth: 1,
    });
    addText(slide, item[0], x + 28, 320, 160, 94, { fontSize: 76, color: i === 0 ? C.white : C.ink, bold: true });
    addText(slide, item[1], x + 28, 430, 300, 38, { fontSize: 25, color: i === 0 ? C.orangeSoft : C.ink, bold: true });
    addText(slide, item[2], x + 28, 486, 300, 58, { fontSize: 18, color: i === 0 ? C.greenSoft : C.muted });
  });
  addText(slide, "Also implemented: background-job progress, cancel/retry, checkpoints, provider caching, quota controls, security headers, and responsive PWA metadata.", 70, 603, 1136, 46, {
    fontSize: 18,
    color: C.ink,
    alignment: "center",
    bold: true,
  });
  addNotes(slide, "Use these counts as proof of implemented breadth, then mention reliability features as the reason the app can support real trips.", [
    "D:/GitHub/Magic-Trip-Planner-Idealize/Frontend/src/components/planner/PlannerWorkspace.tsx - eight-stage workspace",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Frontend/src/components/planner/budget.tsx - print, calendar, and share outputs",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Frontend/src/components/planner/TravelerToolkit.tsx - offline HTML export",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Frontend/src/components/planner/ShareTrip.tsx - viewer/editor roles",
  ]);
}

// Slide 6 - differentiation matrix
{
  const slide = presentation.slides.add();
  slide.background.fill = C.canvas;
  addHeader(slide, "Differentiation", "The advantage is continuity across the whole journey.", 6);
  addText(slide, "Instead of adding another discovery screen, Magic Trip Planner keeps the same decisions connected and editable.", 48, 180, 1120, 44, {
    fontSize: 21,
    color: C.muted,
  });
  const left = 48;
  const top = 258;
  const widths = [340, 250, 250, 344];
  const headers = ["CAPABILITY", "MANUAL TABS", "GENERIC AI CHAT", "MAGIC TRIP PLANNER"];
  let cx = left;
  headers.forEach((h, i) => {
    addRect(slide, cx, top, widths[i], 58, i === 3 ? C.green : C.panel, { lineFill: C.rule, lineWidth: 1 });
    addText(slide, h, cx + 16, top + 17, widths[i] - 32, 28, { fontSize: 16, color: i === 3 ? C.white : C.ink, bold: true, alignment: i === 0 ? "left" : "center" });
    cx += widths[i];
  });
  const rows = [
    ["Sri Lanka-specific context", "User assembles", "Prompt dependent", "Built in"],
    ["Map-verified places", "Manual checks", "Not guaranteed", "Coordinate-backed"],
    ["Daily route + overnight stays", "Separate tools", "Text suggestion", "Connected workflow"],
    ["LKR budget by saved route", "Manual estimate", "Generic estimate", "Deterministic pricing"],
    ["Persistent, restorable plan", "Scattered links", "Conversation only", "Jobs + versions"],
  ];
  rows.forEach((row, r) => {
    let x = left;
    const y = top + 58 + r * 67;
    row.forEach((cell, i) => {
      addRect(slide, x, y, widths[i], 67, i === 3 ? C.greenSoft : C.white, { lineFill: C.rule, lineWidth: 1 });
      addText(slide, cell, x + 14, y + 19, widths[i] - 28, 34, { fontSize: 17, color: i === 3 ? C.ink : C.muted, bold: i === 0 || i === 3, alignment: i === 0 ? "left" : "center" });
      x += widths[i];
    });
  });
  addNotes(slide, "Frame the comparison around workflow continuity rather than claiming that every alternative lacks useful discovery or booking features.", [
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - implemented product capabilities and current limitations",
    "Comparison is qualitative and category-level; no named competitor claims are made.",
  ]);
}

// Slide 7 - market chart plus callouts (Codex Grid chart-evidence silhouette)
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addText(slide, "MARKET FEASIBILITY", 48, 28, 350, 24, { fontSize: 15, color: C.orange, bold: true });
  addText(slide, "Sri Lanka's tourism recovery creates a timely digital planning opportunity.", 48, 65, 1168, 72, {
    fontSize: 38,
    color: C.ink,
    bold: true,
    name: "market-title",
  });
  addText(slide, "Tourist arrivals", 60, 162, 450, 28, { fontSize: 22, color: C.ink, bold: true });
  slide.charts.add("bar", {
    position: { left: 48, top: 198, width: 570, height: 412 },
    categories: ["2024", "2025"],
    series: [{
      name: "Arrivals",
      categories: ["2024", "2025"],
      values: [2053465, 2362521],
      valuesFormatCode: "#,##0",
      fill: C.green2,
      points: [{ idx: 0, fill: C.greenSoft }, { idx: 1, fill: C.orange }],
    }],
    hasLegend: false,
    dataLabels: { showValue: true, position: "outEnd", textStyle: { fill: C.ink, fontSize: 15, bold: true } },
    chartFill: C.white,
    chartLine: { style: "solid", fill: C.white, width: 0 },
    plotAreaFill: { type: "none" },
    plotAreaLine: { style: "solid", fill: C.white, width: 0 },
    xAxis: { textStyle: { fill: C.ink, fontSize: 15, bold: true }, line: { style: "solid", fill: C.rule, width: 1 } },
    yAxis: {
      min: 0,
      max: 2500000,
      majorUnit: 500000,
      numberFormatCode: "0.0,,\"M\"",
      textStyle: { fill: C.muted, fontSize: 12 },
      majorGridlines: { style: "solid", fill: C.panel, width: 1 },
      line: { style: "solid", fill: C.white, width: 0 },
    },
    barOptions: { direction: "column", grouping: "clustered", gapWidth: 60 },
  });
  const market = [
    ["2.36M", "tourist arrivals in 2025"],
    ["+15.1%", "growth versus 2024"],
    ["US$3.2B", "tourism earnings in 2025"],
  ];
  market.forEach((item, i) => {
    const y = 162 + i * 150;
    addRect(slide, 674, y, 556, 124, i === 1 ? C.green : C.panelWarm, {
      geometry: "roundRect",
      borderRadius: 12,
      lineFill: i === 1 ? C.green : C.rule,
      lineWidth: 1,
    });
    addText(slide, item[0], 704, y + 20, 250, 56, { fontSize: 42, color: i === 1 ? C.white : C.ink, bold: true });
    addText(slide, item[1], 954, y + 34, 240, 52, { fontSize: 18, color: i === 1 ? C.greenSoft : C.muted, bold: true });
  });
  addText(slide, "SLTDA's tourism strategy explicitly prioritizes technology-based visitor services and a stronger digital footprint.", 686, 628, 520, 54, {
    fontSize: 17,
    color: C.ink,
    bold: true,
  });
  addText(slide, "07", 1182, 674, 50, 20, { fontSize: 13, color: C.muted, alignment: "right" });
  addNotes(slide, "Use the market data as evidence of opportunity, then connect it to the official policy signal for technology-enabled visitor services.", [
    "https://sltda.gov.lk/en/monthly-tourist-arrivals-reports-2025 - 2024 and 2025 tourist arrivals and 15.1% growth",
    "https://www.cbsl.gov.lk/sites/default/files/cbslweb_documents/publications/aer/2025/en/25_Featured_Chart_08.pdf - 2025 tourism earnings of US$3.219 billion",
    "https://www.sltda.gov.lk/storage/common_media/Sri_Lanka-Final_V6_Edited850147500.pdf - technology-based tourism sector priority",
  ]);
}

// Slide 8 - market entry and commercial model
{
  const slide = presentation.slides.add();
  slide.background.fill = C.canvas;
  addHeader(slide, "Go to market", "Start focused, then expand with the travel ecosystem.", 8);
  addText(slide, "The first objective is repeatable planning adoption; monetization follows once traveler intent and partner value are validated.", 48, 182, 1100, 48, {
    fontSize: 21,
    color: C.muted,
  });
  const segments = [
    ["01", "Independent visitors", "International travelers who want a Sri Lanka-specific route, stays, and costs before arrival.", "Reach: SEO, creator itineraries, university and travel communities"],
    ["02", "Groups and diaspora", "Friends, families, and returning Sri Lankans coordinating shared decisions and realistic budgets.", "Reach: referrals, collaborative planning, community partnerships"],
    ["03", "Travel partners", "Hotels, guides, and operators who benefit from higher-intent, better-prepared travelers.", "Reach: pilot integrations and curated local inventory"],
  ];
  segments.forEach((item, i) => {
    const x = 48 + i * 400;
    addText(slide, item[0], x, 270, 70, 50, { fontSize: 36, color: C.orange, bold: true });
    addText(slide, item[1], x, 332, 350, 42, { fontSize: 25, color: C.ink, bold: true });
    addText(slide, item[2], x, 392, 350, 94, { fontSize: 18, color: C.muted });
    addRule(slide, x, 506, 350, C.rule, 1);
    addText(slide, item[3], x, 528, 350, 76, { fontSize: 16, color: C.ink, bold: true });
  });
  addRect(slide, 48, 628, 1184, 48, C.green);
  addText(slide, "COMMERCIAL MODEL TO VALIDATE: freemium planning + affiliate referrals + B2B white-label/API", 72, 641, 1136, 24, {
    fontSize: 17,
    color: C.white,
    bold: true,
    alignment: "center",
  });
  addNotes(slide, "Be explicit that the commercial model is the validation plan, not current revenue. The near-term KPI is completed, shared, or exported itineraries.", [
    "Commercial model and acquisition channels are team hypotheses for validation; no current revenue or traction is claimed.",
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - implemented sharing, collaboration, and export surfaces",
  ]);
}

// Slide 9 - scalable architecture diagram
{
  const slide = presentation.slides.add();
  slide.background.fill = C.white;
  addHeader(slide, "Future scalability", "A durable architecture supports reliability today and scale tomorrow.", 9);
  addText(slide, "The system separates the fast user interface from long-running planning work, persistent state, and external providers.", 48, 182, 1080, 46, {
    fontSize: 21,
    color: C.muted,
  });
  // Arrows first so they remain behind the nodes.
  addRect(slide, 282, 335, 84, 34, C.orange, { geometry: "rightArrow", name: "arch-arrow-1" });
  addRect(slide, 574, 335, 84, 34, C.orange, { geometry: "rightArrow", name: "arch-arrow-2" });
  addRect(slide, 866, 335, 84, 34, C.orange, { geometry: "rightArrow", name: "arch-arrow-3" });
  addRect(slide, 1028, 468, 34, 88, C.orange, { geometry: "downArrow", name: "arch-arrow-down" });

  const nodes = [
    [48, 274, "NEXT.JS PWA", "Responsive traveler experience"],
    [340, 274, "FASTAPI", "Cookie-authenticated JSON API"],
    [632, 274, "POSTGRESQL", "Trips, jobs, versions, caches"],
    [924, 274, "PLANNING WORKER", "Durable background orchestration"],
  ];
  nodes.forEach((item, i) => {
    addRect(slide, item[0], item[1], 242, 154, i === 3 ? C.green : C.panel, {
      geometry: "roundRect",
      borderRadius: 14,
      lineFill: i === 3 ? C.green : C.rule,
      lineWidth: 1,
    });
    addText(slide, item[2], item[0] + 20, item[1] + 34, 202, 32, { fontSize: 21, color: i === 3 ? C.white : C.ink, bold: true, alignment: "center" });
    addText(slide, item[3], item[0] + 20, item[1] + 84, 202, 50, { fontSize: 16, color: i === 3 ? C.greenSoft : C.muted, alignment: "center" });
  });
  addRect(slide, 834, 548, 396, 82, C.panelWarm, { geometry: "roundRect", borderRadius: 12, lineFill: C.rule, lineWidth: 1 });
  addText(slide, "GEMINI + MAP / WEATHER / MEDIA / FARE PROVIDERS", 858, 566, 348, 44, { fontSize: 17, color: C.ink, bold: true, alignment: "center" });
  addText(slide, "Structured AI output  •  provider cache  •  fallbacks  •  quota controls", 230, 648, 820, 22, {
    fontSize: 17,
    color: C.green2,
    bold: true,
    alignment: "center",
  });
  addNotes(slide, "Explain the scaling logic: web requests stay responsive, the worker can scale independently, and PostgreSQL keeps jobs and plans durable across process restarts.", [
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - architecture and production topology",
    "D:/GitHub/Magic-Trip-Planner-Idealize/DEPLOYMENT.md - Vercel, Azure, worker, and PostgreSQL deployment model",
    "D:/GitHub/Magic-Trip-Planner-Idealize/Backend/app/workers/planning_worker.py - durable worker orchestration",
  ]);
}

// Slide 10 - roadmap timeline
{
  const slide = presentation.slides.add();
  slide.background.fill = C.canvas;
  addHeader(slide, "Roadmap", "Scale through trust, reach, and transaction depth.", 10);
  addText(slide, "The product can grow without changing its core promise: one reliable plan that stays useful before and during the trip.", 48, 182, 1090, 46, {
    fontSize: 21,
    color: C.muted,
  });
  addRule(slide, 128, 360, 1024, C.orange, 4);
  const roadmap = [
    [180, "NOW", "Strengthen trust", "Public deployment\nprovider monitoring\nreal-user usability tests"],
    [640, "NEXT", "Grow planning value", "Live availability signals\nlocal partner inventory\nmultilingual experience"],
    [1100, "SCALE", "Deepen transactions", "Booking and payments\npartner API / white-label\nregional destination expansion"],
  ];
  roadmap.forEach((item, i) => {
    addRect(slide, item[0] - 18, 342, 36, 36, i === 1 ? C.orange : C.green, { geometry: "ellipse", lineFill: C.white, lineWidth: 4 });
    const x = i === 0 ? 80 : i === 1 ? 486 : 894;
    addLabel(slide, item[1], x, 404, 190, i === 1 ? C.orange : C.green2);
    addText(slide, item[2], x, 444, 300, 38, { fontSize: 25, color: C.ink, bold: true });
    addText(slide, item[3], x, 500, 300, 104, { fontSize: 18, color: C.muted });
  });
  addText(slide, "Current code already provides the foundations: modular providers, persistent data, role-based collaboration, and export surfaces.", 166, 628, 948, 42, {
    fontSize: 18,
    color: C.ink,
    bold: true,
    alignment: "center",
  });
  addNotes(slide, "Treat this as a sequence of validation gates. Trust and deployment quality come before transaction features or geographic expansion.", [
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - current capabilities and limitations",
    "Roadmap items are planned future work, not currently implemented features.",
  ]);
}

// Slide 11 - close
{
  const slide = presentation.slides.add();
  slide.background.fill = C.green;
  addText(slide, "MAGIC TRIP PLANNER", 54, 48, 420, 28, { fontSize: 16, color: C.orangeSoft, bold: true });
  addText(slide, "Make every Sri Lanka trip easier to plan - and easier to trust.", 54, 142, 1040, 186, {
    fontSize: 58,
    color: C.white,
    bold: true,
    autoFit: "none",
    name: "closing-title",
  });
  addRule(slide, 54, 370, 118, C.orange, 7);
  const proof = [
    "Working web application",
    "Market-aligned Sri Lanka focus",
    "Scalable full-stack foundation",
  ];
  proof.forEach((text, i) => {
    const y = 426 + i * 58;
    addRect(slide, 56, y + 5, 14, 14, C.orange, { geometry: "ellipse" });
    addText(slide, text, 88, y, 510, 30, { fontSize: 22, color: C.greenSoft, bold: true });
  });
  addRect(slide, 730, 418, 430, 140, C.white, { geometry: "roundRect", borderRadius: 16 });
  addText(slide, "READY FOR THE LIVE DEMO", 760, 448, 370, 32, { fontSize: 18, color: C.orange, bold: true, alignment: "center" });
  addText(slide, "Public hosted link submitted separately", 760, 498, 370, 34, { fontSize: 22, color: C.ink, bold: true, alignment: "center" });
  addText(slide, "IDEALIZE 2026  /  SEMI-FINALS", 54, 660, 390, 22, { fontSize: 14, color: C.orangeSoft, bold: true });
  addNotes(slide, "Close by resolving the opening promise, then transition immediately into the live product demonstration.", [
    "D:/IDEALIZE 2026 - SEMI FINALS - SUBMISSION GUIDELINES.pdf - working public web application and pitch-deck requirements",
    "D:/GitHub/Magic-Trip-Planner-Idealize/README.md - product and architecture summary",
  ]);
}

await fs.mkdir(path.dirname(FINAL), { recursive: true });
await fs.mkdir(`${TMP}/renders`, { recursive: true });

for (const [index, slide] of presentation.slides.items.entries()) {
  const png = await presentation.export({ slide, format: "png", scale: 1 });
  await fs.writeFile(`${TMP}/renders/slide-${String(index + 1).padStart(2, "0")}.png`, new Uint8Array(await png.arrayBuffer()));
  const layout = await slide.export({ format: "layout" });
  await fs.writeFile(`${TMP}/renders/slide-${String(index + 1).padStart(2, "0")}.layout.json`, await layout.text());
}

const montage = await presentation.export({ format: "webp", montage: true, scale: 1 });
await fs.writeFile(`${TMP}/renders/deck-montage.webp`, new Uint8Array(await montage.arrayBuffer()));

const pptx = await PresentationFile.exportPptx(presentation);
await pptx.save(FINAL);

const inspect = await presentation.inspect({ kind: "slide,textbox,shape,image,chart,notes", maxChars: 18000 });
await fs.writeFile(`${TMP}/renders/deck-inspect.ndjson`, inspect.ndjson);
console.log(JSON.stringify({ final: FINAL, slides: presentation.slides.items.length }, null, 2));
