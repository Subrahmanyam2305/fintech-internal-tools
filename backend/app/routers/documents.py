import re

from fastapi import APIRouter, Response

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("/{name}.svg")
def document_svg(name: str):
    label = name.replace("_", " ").strip()
    m = re.match(r"^(.*?)(\d+)$", label)
    if m:
        base, num = m.group(1).strip(), m.group(2)
        label = f"{base.title()} · #{num}"
    else:
        label = label.title()

    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" width="320" height="220" viewBox="0 0 320 220">
  <rect width="320" height="220" rx="12" fill="#e5e7eb"/>
  <rect x="24" y="24" width="272" height="172" rx="8" fill="#f3f4f6" stroke="#d1d5db"/>
  <rect x="120" y="60" width="80" height="60" rx="6" fill="#d1d5db"/>
  <circle cx="160" cy="82" r="12" fill="#9ca3af"/>
  <path d="M136 120 a24 16 0 0 1 48 0 z" fill="#9ca3af"/>
  <rect x="90" y="140" width="140" height="10" rx="5" fill="#d1d5db"/>
  <text x="160" y="180" font-family="sans-serif" font-size="14" fill="#6b7280" text-anchor="middle">{label}</text>
</svg>"""
    return Response(content=svg, media_type="image/svg+xml")
