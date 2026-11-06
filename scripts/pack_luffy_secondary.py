"""Pack the three transparent pose plates at Luffy's existing 256px pivot."""
import json
from pathlib import Path

from PIL import Image, ImageDraw
from pack_luffy_normals import anchor_in_body, body_boxes


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "art/luffy-secondary-source"
CELL = 256
PIVOT = (128, 224)
COLUMNS = 8

# Per-pose horizontal support, in plate-cell pixels. The sole or the
# bottom of a falling silhouette is aligned to the existing vertical pivot.
PLATES = {
    "guard": (3, .37, [
        ("guardStandA", 198), ("guardStandB", 200), ("guardLowA", 195),
        ("guardLowB", 205), ("guardStandHitA", 218), ("guardStandHitB", 217),
        ("guardLowHitA", 218), ("guardLowHitB", 202), ("guardExit", 202),
    ]),
    "damage": (4, .44, [
        ("hitLight", 191), ("hitMedium", 191), ("hitHeavy", 192), ("hitLow", 168),
        ("hitAir", 176), ("launched", 190), ("airKnockback", 145), ("falling", 147),
        ("downed", 193), ("getupStart", 179), ("getupEnd", 170), ("ko", 167),
    ]),
    "personality": (4, .41, [
        ("entryWalk", 184), ("entryReady", 183), ("tauntBeckon", 175), ("tauntGrin", 176),
        ("victoryJump", 185), ("victoryCheer", 183), ("defeatKneel", 168), ("defeatGround", 184),
        ("throwPrep", 161), ("throwReach", 139), ("throwRelease", 168), ("throwRecover", 175),
    ]),
}


def main():
    count = sum(len(entries) for _, _, entries in PLATES.values())
    atlas = Image.new("RGBA", (CELL * COLUMNS, CELL * ((count + COLUMNS - 1) // COLUMNS)))
    poses = {}
    for plate, (columns, scale, entries) in PLATES.items():
        image = Image.open(SOURCE / f"{plate}.png").convert("RGBA")
        for i, (name, support) in enumerate(entries):
            col, row = i % columns, i // columns
            crop = image.crop((
                col * image.width // columns, row * image.height // 3,
                (col + 1) * image.width // columns, (row + 1) * image.height // 3,
            ))
            alpha = crop.getchannel("A").point(lambda value: 255 if value >= 225 else 0)
            bounds = alpha.getbbox()
            assert bounds and bounds[0] > 0 and bounds[1] > 0
            assert bounds[2] < crop.width and bounds[3] < crop.height, (plate, name, bounds)
            if name == "throwReach":
                # The forward forearm is replaced by the engine's elastic
                # hand. Preserve the bent rear arm and the face above the cut.
                ImageDraw.Draw(alpha).polygon(
                    [(213, 145), (247, 132), (355, 118), (355, 180), (208, 180)],
                    fill=0,
                )
            crop.putalpha(alpha)
            sprite = crop.resize(tuple(round(v * scale) for v in crop.size), Image.Resampling.NEAREST)
            # Use the resampled sole instead of rounding the source extent
            # independently. This prevents visible one-pixel floor jitter.
            bottom = sprite.getbbox()[3]
            x = PIVOT[0] - round(support * scale)
            y = PIVOT[1] - bottom - (16 if name == "victoryJump" else 0)
            cell = Image.new("RGBA", (CELL, CELL))
            cell.alpha_composite(sprite, (x, y))
            box = cell.getbbox()
            assert box and 0 < box[0] < box[2] < CELL and 0 < box[1] < box[3] <= PIVOT[1], (name, box)
            frame = len(poses)
            poses[name] = {"frame": frame, "hurtboxes": body_boxes(cell)}
            if name == "throwReach":
                poses[name]["joint"] = anchor_in_body(
                    cell, x + round(210 * scale), y + round(151 * scale),
                )
            atlas.paste(cell, (frame % COLUMNS * CELL, frame // COLUMNS * CELL))
    atlas.save(ROOT / "public/sprites/luffy/secondary.png")
    # Render an aligned contact sheet at gameplay scale for asset review.
    contact = Image.new("RGBA", (1056, 1020), "#111b26")
    labels = [
        "Guarda em pe 1", "Guarda em pe 2", "Guarda baixa 1",
        "Guarda baixa 2", "Bloqueio alto 1", "Bloqueio alto 2",
        "Bloqueio baixo 1", "Bloqueio baixo 2", "Retorno da guarda",
        "Dano leve", "Dano medio", "Dano forte", "Dano baixo",
        "Dano aereo", "Lancamento", "Recuo aereo", "Queda", "Derrubado",
        "Levantar 1", "Levantar 2", "KO", "Entrada 1", "Entrada 2",
        "Provocacao 1", "Provocacao 2", "Vitoria 1", "Vitoria 2",
        "Perda de equilibrio", "Derrota", "Agarrar - preparo",
        "Agarrar - alcance", "Arremesso", "Recuperacao",
    ]
    draw = ImageDraw.Draw(contact)
    for (name, data), label in zip(poses.items(), labels, strict=True):
        i = data["frame"]
        left, top = i % 6 * 176, i // 6 * 170
        x, y = i % COLUMNS * CELL, i // COLUMNS * CELL
        cell = atlas.crop((x + 40, y + 72, x + 216, y + 224))
        draw.rectangle((left + 2, top + 2, left + 173, top + 167), fill="#202d39")
        draw.line((left + 5, top + 152, left + 171, top + 152), fill="#41676a")
        contact.alpha_composite(cell, (left, top))
        draw.text((left + 8, top + 154), label, fill="#f0dbab")
    contact.convert("RGB").save(ROOT / "public/sprites/luffy/secondary-contact.png")
    (ROOT / "src/data/luffy-secondary-poses.json").write_text(
        json.dumps(poses, separators=(",", ":")) + "\n", encoding="utf-8",
    )


if __name__ == "__main__":
    main()
