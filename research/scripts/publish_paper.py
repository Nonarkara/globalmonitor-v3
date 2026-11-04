"""Copy the compiled PDF into public/research, render page images, write src/data/researchPaper.json."""
import json, pathlib, re, subprocess, shutil
from PIL import Image, ImageChops

ROOT = pathlib.Path(__file__).resolve().parents[2]
PDF_SRC = ROOT / "research/paper/main.pdf"
PUB = ROOT / "public/research"
PAGES = PUB / "pages"
NAME = "seeing-a-war-without-standing-in-it.pdf"

shutil.rmtree(PAGES, ignore_errors=True); PAGES.mkdir(parents=True)
shutil.copy(PDF_SRC, PUB / NAME)
subprocess.run(["pdftoppm", "-r", "160", "-png", str(PDF_SRC), str(PAGES / "p")], check=True)
images = []
pngs = sorted(PAGES.glob("p-*.png"))
for n, png in enumerate(pngs):
    im = Image.open(png).convert("RGB")
    if n == len(pngs) - 1:  # last page is mostly blank: keep the ink plus a margin
        box = ImageChops.difference(im, Image.new("RGB", im.size, (255, 255, 255))).getbbox()
        if box:
            im = im.crop((0, 0, im.width, min(im.height, box[3] + 48)))
    im.save(png)
    webp = png.with_suffix(".webp")
    subprocess.run(["cwebp", "-quiet", "-q", "80", str(png), "-o", str(webp)], check=True)
    png.unlink()
    images.append({"src": f"/research/pages/{webp.name}", "w": im.width, "h": im.height})

info = subprocess.run(["pdfinfo", str(PDF_SRC)], capture_output=True, text=True, check=True).stdout
pages = int(re.search(r"Pages:\s+(\d+)", info).group(1))
tex = (ROOT / "research/paper/main.tex").read_text()
figures = len(re.findall(r"\\begin\{figure\*?\}", tex))
refs = len(re.findall(r"^@", (ROOT / "research/paper/references.bib").read_text(), re.M))
meta = json.loads((ROOT / "research/paper/meta.json").read_text())
meta.update(pages=pages, figures=figures, references=refs, pdf=f"/research/{NAME}", pageImages=images)
(ROOT / "src/data/researchPaper.json").write_text(json.dumps(meta, indent=2, ensure_ascii=False) + "\n")
print(pages, "pages", figures, "figures", refs, "refs", len(images), "images")
