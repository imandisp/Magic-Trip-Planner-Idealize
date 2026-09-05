import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, PresentationFile } from "file:///C:/Users/vibod/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs";

const workspace = "D:/GitHub/Magic-Trip-Planner-Idealize/tmp/idealize_deck_revision";
const starterPath = path.join(workspace, "template", "template-starter.pptx");
const outputPath = "D:/GitHub/Magic-Trip-Planner-Idealize/output/presentation/Magic_Trip_Planner_IDEALIZE_2026_Semi_Final_Revised.pptx";
const beforeDir = path.join(workspace, "before");
const afterDir = path.join(workspace, "after");
const finalLayoutDir = path.join(workspace, "template", "final-layout");

async function writeBlob(filePath, blob) {
  await fs.writeFile(filePath, new Uint8Array(await blob.arrayBuffer()));
}

function appendSource(notesText, sourceLine) {
  if (notesText.includes(sourceLine)) return notesText;
  if (notesText.includes("[/Sources]")) {
    return notesText.replace("[/Sources]", `${sourceLine}\n[/Sources]`);
  }
  return `${notesText.trim()}\n\n[Sources]\n${sourceLine}\n[/Sources]`;
}

async function main() {
  await Promise.all([
    fs.mkdir(path.dirname(outputPath), { recursive: true }),
    fs.mkdir(beforeDir, { recursive: true }),
    fs.mkdir(afterDir, { recursive: true }),
    fs.mkdir(finalLayoutDir, { recursive: true }),
  ]);

  const presentation = await PresentationFile.importPptx(await FileBlob.load(starterPath));
  const inventory = await presentation.inspect({
    kind: "slide,textbox,notes",
    maxChars: 100000,
  });
  const records = inventory.ndjson
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  const resolveNamed = (slideNumber, name) => {
    const record = records.find((item) => item.slide === slideNumber && item.name === name);
    if (!record) throw new Error(`Could not resolve ${name} on slide ${slideNumber}`);
    return presentation.resolve(record.id);
  };
  const resolveNotes = (slideNumber) => {
    const record = records.find((item) => item.kind === "notes" && item.slide === slideNumber);
    if (!record) throw new Error(`Could not resolve notes on slide ${slideNumber}`);
    return presentation.resolve(record.id);
  };

  const affectedSlides = [
    { number: 1 },
    { number: 2 },
    { number: 10 },
  ];

  for (const item of affectedSlides) {
    const slide = presentation.slides.getItem(item.number - 1);
    await writeBlob(
      path.join(beforeDir, `slide-${String(item.number).padStart(2, "0")}.png`),
      await presentation.export({ slide, format: "png", scale: 2 }),
    );
    await fs.writeFile(
      path.join(beforeDir, `slide-${String(item.number).padStart(2, "0")}.layout.json`),
      await (await slide.export({ format: "layout" })).text(),
    );
  }

  resolveNamed(1, "text-54-656").text.replace(
    "WEB APPLICATION PITCH DECK",
    "FALCON CODE  /  UNIVERSITY OF MORATUWA",
  );

  resolveNamed(2, "title-2").text.replace(
    "Planning a trip still means stitching disconnected decisions together.",
    "Static itineraries fail when real-world travel conditions change.",
  );
  resolveNamed(2, "text-48-184").text.replace(
    "Travelers discover places, check routes, compare stays, and estimate costs in separate tools. Each decision can invalidate the next.",
    "Travelers compare weather, routes, stays, attractions, transport, and reviews across disconnected tools—then resolve every conflict manually.",
  );
  resolveNamed(2, "text-78-412").text.replace(
    "A plan that looks exciting can still fail on timing, distance, accommodation, or budget.",
    "Decision fatigue, inefficient planning, and unexpected disruptions before and during the journey.",
  );
  resolveNamed(2, "text-798-194").text.replace("Discovery overload", "Fragmented planning");
  resolveNamed(2, "text-798-236").text.replace(
    "Attractions and stays are compared without a single trip context.",
    "Weather, routes, stays, transport, and attractions live in separate tools.",
  );
  resolveNamed(2, "text-798-332").text.replace("Route reality", "Experience blind spots");
  resolveNamed(2, "text-798-374").text.replace(
    "Travel time, stop order, and daily hotel endpoints are easy to underestimate.",
    "Shortest-route tools miss timing, weather, closures, availability, and safety.",
  );
  resolveNamed(2, "text-798-470").text.replace("Budget uncertainty", "Static & stale guidance");
  resolveNamed(2, "text-798-512").text.replace(
    "Costs are rarely combined into one Sri Lanka-ready LKR estimate.",
    "Fixed itineraries and outdated reviews fail to reflect current conditions.",
  );

  resolveNamed(10, "text-486-500").text.replace(
    "local partner inventory",
    "community travel intelligence",
  );
  const scaleRoadmap = resolveNamed(10, "text-894-500");
  scaleRoadmap.text.replace("Booking and payments", "Transport + hotel integrations");
  scaleRoadmap.text.replace("partner API / white-label", "verified guide marketplace");
  scaleRoadmap.text.replace("regional destination expansion", "international expansion");

  const slide1Notes = resolveNotes(1);
  slide1Notes.setText(appendSource(
    slide1Notes.text,
    "- D:/Falcon_Code_Proposal.pdf - Falcon Code team identity and University of Moratuwa affiliation (pp. 2-5)",
  ));

  const slide2Notes = resolveNotes(2);
  slide2Notes.setText([
    "Frame the problem as a real-world adaptability gap: travelers must coordinate disconnected information themselves, while static itineraries and stale reviews do not keep pace with changing conditions.",
    "",
    "[Sources]",
    "- D:/Falcon_Code_Proposal.pdf - Problem Statement (p. 6)",
    "- D:/GitHub/Magic-Trip-Planner-Idealize/README.md - product problem and workflow framing",
    "- D:/GitHub/Magic-Trip-Planner-Idealize/Frontend/src/app/page.tsx - user-facing value proposition",
    "[/Sources]",
  ].join("\n"));

  const slide10Notes = resolveNotes(10);
  slide10Notes.setText(appendSource(
    slide10Notes.text,
    "- D:/Falcon_Code_Proposal.pdf - community intelligence, transport/hotel collaboration, verified guides, and international expansion (pp. 7, 11)",
  ));

  const focused = await presentation.inspect({
    kind: "slide,textbox,notes",
    search: "Static itineraries|Falcon Code|community travel intelligence|verified guide marketplace",
    maxChars: 12000,
  });
  await fs.writeFile(path.join(workspace, "after-inspect.ndjson"), focused.ndjson);

  for (const item of affectedSlides) {
    const slide = presentation.slides.getItem(item.number - 1);
    await writeBlob(
      path.join(afterDir, `slide-${String(item.number).padStart(2, "0")}.png`),
      await presentation.export({ slide, format: "png", scale: 2 }),
    );
    await fs.writeFile(
      path.join(afterDir, `slide-${String(item.number).padStart(2, "0")}.layout.json`),
      await (await slide.export({ format: "layout" })).text(),
    );
  }

  for (const [index, slide] of presentation.slides.items.entries()) {
    const stem = `final-slide-${String(index + 1).padStart(2, "0")}`;
    await writeBlob(path.join(afterDir, `${stem}.png`), await presentation.export({ slide, format: "png", scale: 1 }));
    await fs.writeFile(path.join(finalLayoutDir, `${stem}.layout.json`), await (await slide.export({ format: "layout" })).text());
  }

  await writeBlob(
    path.join(afterDir, "final-montage.webp"),
    await presentation.export({ format: "webp", montage: true, scale: 1 }),
  );

  const pptx = await PresentationFile.exportPptx(presentation);
  await pptx.save(outputPath);
  console.log(outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
