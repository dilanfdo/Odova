#!/usr/bin/env bash
# Builds Google Play listing graphics from the raw captures in screenshots/.
# Output, all 8-bit RGB PNG with no alpha (Play rejects transparency):
#   screenshots/play-store/                          phone 1080x1920 (9:16) + feature graphic 1024x500
#   screenshots/play-store/7-inch/                   tablet 1920x1080 (16:9)
#   screenshots/play-store/10-inch/                  tablet 2560x1440 (16:9)
# Both tablet sizes satisfy Play's large-screen rules: 16:9, each side between
# 1080 and 3840 px. Play uses the same rules for the 7-inch and 10-inch slots.
# Requires ImageMagick 7 (`magick`).
set -euo pipefail

cd "$(dirname "$0")/.."
SRC=screenshots
OUT=screenshots/play-store
TMP=$(mktemp -d "${TMPDIR:-.}/odova-store.XXXXXX")
trap 'rm -rf "$TMP"' EXIT
mkdir -p "$OUT"

FONT_BOLD="/System/Library/Fonts/Supplemental/Arial Bold.ttf"
FONT_REG="/System/Library/Fonts/Supplemental/Arial.ttf"

BG_TOP='#4a4fe8'
BG_BOTTOM='#2b2da6'
CORAL='#ff8e7f'
SUB_COLOR='#dfe2ff'

W=1080
H=1920

# Background: indigo gradient with soft organic blobs. $2 = 1 mirrors the blobs so
# neighbouring panels don't look identical.
background() {
  local out=$1 mirror=$2
  magick -size ${W}x${H} gradient:"$BG_TOP"-"$BG_BOTTOM" "$TMP/grad.png"
  magick -size ${W}x${H} xc:none \
    -fill 'rgba(255,255,255,0.07)' -draw "circle 960,260 960,560" \
    -fill 'rgba(255,255,255,0.05)' -draw "circle 120,980 120,1260" \
    -fill "$CORAL" -draw "ellipse 40,1560 230,300 0,360" \
    -fill 'rgba(255,214,102,0.95)' -draw "circle 1010,1180 1010,1230" \
    -fill 'rgba(255,255,255,0.10)' -draw "ellipse 1040,1720 260,200 0,360" \
    "$TMP/blobs.png"
  if [[ $mirror == 1 ]]; then magick "$TMP/blobs.png" -flop "$TMP/blobs.png"; fi
  magick "$TMP/grad.png" "$TMP/blobs.png" -composite "$out"
}

# Phone: screenshot with rounded corners inside a dark bezel with a punch-hole camera.
# $3 = screen width in px.
phone() {
  local shot=$1 out=$2 sw=$3
  local bezel=$((sw / 39))
  local sh r
  magick "$shot" -alpha off -filter Lanczos -resize "${sw}x" -unsharp 0x0.6 "$TMP/screen.png"
  sh=$(magick identify -format '%h' "$TMP/screen.png")
  r=$((sw * 9 / 100))
  magick -size ${sw}x${sh} xc:black -fill white \
    -draw "roundrectangle 0,0,$((sw - 1)),$((sh - 1)),$r,$r" "$TMP/mask.png"
  magick "$TMP/screen.png" "$TMP/mask.png" -alpha off -compose CopyOpacity -composite "$TMP/screen-r.png"

  local fw=$((sw + bezel * 2)) fh=$((sh + bezel * 2)) fr=$((r + bezel))
  local cam_r=$((sw / 56)) cam_y=$((bezel + sh * 30 / 1024))
  magick -size ${fw}x${fh} xc:none \
    -fill '#0e0f1f' -draw "roundrectangle 0,0,$((fw - 1)),$((fh - 1)),$fr,$fr" \
    -fill 'rgba(255,255,255,0.12)' -draw "roundrectangle 2,2,$((fw - 3)),$((fh - 3)),$((fr - 2)),$((fr - 2))" \
    -fill '#0e0f1f' -draw "roundrectangle 5,5,$((fw - 6)),$((fh - 6)),$((fr - 5)),$((fr - 5))" \
    "$TMP/screen-r.png" -geometry +${bezel}+${bezel} -composite \
    -fill '#05060d' -draw "circle $((fw / 2)),$cam_y $((fw / 2 + cam_r)),$cam_y" \
    "$out"
}

# Drop shadow drawn on the canvas under where the phone will sit.
shadow_on() {
  local canvas=$1 x=$2 y=$3 pw=$4 ph=$5 r=$6
  magick "$canvas" \
    \( -size ${W}x${H} xc:none -fill 'rgba(8,8,48,0.55)' \
       -draw "roundrectangle $x,$((y + 36)),$((x + pw)),$((y + ph + 36)),$r,$r" -blur 0x34 \) \
    -composite "$canvas"
}

panel() {
  local n=$1 shot=$2 slug=$3 headline=$4 sub=$5
  local mirror=$(( (10#$n + 1) % 2 ))
  local canvas="$TMP/canvas.png"
  background "$canvas" "$mirror"

  magick -background none \
    \( -size 920x -font "$FONT_BOLD" -pointsize 94 -interline-spacing -8 -fill white caption:"$headline" \) \
    \( -size 920x26 xc:none \) \
    \( -size 920x -font "$FONT_REG" -pointsize 42 -interline-spacing 4 -fill "$SUB_COLOR" caption:"$sub" \) \
    -append "$TMP/text.png"
  local th
  th=$(magick identify -format '%h' "$TMP/text.png")

  phone "$shot" "$TMP/phone.png" 780
  local pw ph
  pw=$(magick identify -format '%w' "$TMP/phone.png")
  ph=$(magick identify -format '%h' "$TMP/phone.png")
  local px=$(( (W - pw) / 2 )) py=$(( 130 + th + 80 ))

  shadow_on "$canvas" "$px" "$py" "$pw" "$ph" 90
  magick "$canvas" \
    "$TMP/text.png" -geometry +80+130 -composite \
    "$TMP/phone.png" -geometry +${px}+${py} -composite \
    -crop ${W}x${H}+0+0 +repage -alpha off -depth 8 -define png:color-type=2 \
    "$OUT/${n}-${slug}.png"
  echo "  $OUT/${n}-${slug}.png"
}

# Landscape tablet panel. Sizes are set by render_tablets before the calls.
# Headline sits on the left, phone is fully visible on the right.
landscape_background() {
  local out=$1 mirror=$2
  local w=$LW h=$LH
  magick -size ${w}x${h} gradient:"$BG_TOP"-"$BG_BOTTOM" "$TMP/lgrad.png"
  magick -size ${w}x${h} xc:none \
    -fill 'rgba(255,255,255,0.08)' -draw "circle $((w * 86 / 100)),$((h * 18 / 100)) $((w * 86 / 100)),$((h * 18 / 100 + h * 28 / 100))" \
    -fill 'rgba(255,255,255,0.05)' -draw "ellipse $((w * 16 / 100)),$((h * 86 / 100)) $((w * 22 / 100)),$((h * 30 / 100)) 0,360" \
    -fill "$CORAL" -draw "ellipse $((w * 4 / 100)),$((h * 78 / 100)) $((w * 14 / 100)),$((h * 34 / 100)) 0,360" \
    -fill 'rgba(255,214,102,0.95)' -draw "circle $((w * 60 / 100)),$((h * 46 / 100)) $((w * 60 / 100 + h * 5 / 100)),$((h * 46 / 100))" \
    "$TMP/lblobs.png"
  if [[ $mirror == 1 ]]; then magick "$TMP/lblobs.png" -flop "$TMP/lblobs.png"; fi
  magick "$TMP/lgrad.png" "$TMP/lblobs.png" -composite "$out"
}

landscape_panel() {
  local n=$1 shot=$2 slug=$3 headline=$4 sub=$5
  local mirror=$(( (10#$n + 1) % 2 ))
  local canvas="$TMP/lcanvas.png"
  landscape_background "$canvas" "$mirror"

  magick -background none \
    \( -size ${LTEXT_W}x -font "$FONT_BOLD" -pointsize "$LHEAD" -interline-spacing -6 -fill white caption:"$headline" \) \
    \( -size ${LTEXT_W}x$((LH / 40)) xc:none \) \
    \( -size ${LTEXT_W}x -font "$FONT_REG" -pointsize "$LSUB" -interline-spacing 6 -fill "$SUB_COLOR" caption:"$sub" \) \
    -append "$TMP/ltext.png"
  local th tw
  th=$(magick identify -format '%h' "$TMP/ltext.png")
  tw=$(magick identify -format '%w' "$TMP/ltext.png")
  local tx=$LMARGIN ty=$(( (LH - th) / 2 ))

  phone "$shot" "$TMP/lphone.png" "$LSW"
  local pw ph
  pw=$(magick identify -format '%w' "$TMP/lphone.png")
  ph=$(magick identify -format '%h' "$TMP/lphone.png")
  local px=$(( LW - LMARGIN - pw )) py=$(( (LH - ph) / 2 ))
  local drop=$(( LH * 24 / 1080 )) blur=$(( LH * 26 / 1080 ))

  magick "$canvas" \
    \( -size ${LW}x${LH} xc:none -fill 'rgba(8,8,48,0.50)' \
       -draw "roundrectangle $px,$((py + drop)),$((px + pw)),$((py + ph + drop)),60,60" -blur 0x${blur} \) -composite \
    "$TMP/ltext.png" -geometry +${tx}+${ty} -composite \
    "$TMP/lphone.png" -geometry +${px}+${py} -composite \
    -crop ${LW}x${LH}+0+0 +repage -alpha off -depth 8 -define png:color-type=2 \
    "$LOUT/${n}-${slug}.png"
  echo "  $LOUT/${n}-${slug}.png"
}

render_tablets() {
  local tag=$1
  LW=$2; LH=$3
  LSW=$(( LH * 40 / 100 ))
  LHEAD=$(( LH * 82 / 1080 ))
  LSUB=$(( LH * 34 / 1080 ))
  LTEXT_W=$(( LW * 48 / 100 ))
  LMARGIN=$(( LW * 5 / 100 ))
  LOUT="$OUT/$tag"
  mkdir -p "$LOUT"
  echo "Rendering $tag (${LW}x${LH})"
  landscape_panel 01 "$SRC/02-dashboard.png"      dashboard      "Know your real\nfuel economy"     "Efficiency, spend and cost per km at a glance"
  landscape_panel 02 "$SRC/03-add-fill.png"       log-fill-up    "Log a fill-up\nin seconds"        "Total cost worked out as you type"
  landscape_panel 03 "$SRC/07-fill-history.png"   history        "Every fill-up\nin one place"      "A tidy history with cost and efficiency per tank"
  landscape_panel 04 "$SRC/04-maintenance.png"    maintenance    "Never miss\na service"            "Oil changes, tyres and renewals, all tracked"
  landscape_panel 05 "$SRC/05-add-reminder.png"   reminders      "Remind by date\nor odometer"      "Repeating reminders schedule themselves"
  landscape_panel 06 "$SRC/06-vehicle-picker.png" multi-vehicle  "All your vehicles,\none garage"   "Switch between cars with a single tap"
  landscape_panel 07 "$SRC/08-settings.png"       sync           "Your garage on\nevery device"     "Use a sync code or sign in. No account needed."
  landscape_panel 08 "$SRC/01-onboarding.png"     get-started    "Start tracking\ntoday"            "Free, simple and private by default"
}

feature_graphic() {
  local fw=1024 fh=500 out="$OUT/00-feature-graphic-1024x500.png"
  magick -size ${fw}x${fh} gradient:"$BG_TOP"-"$BG_BOTTOM" \
    -fill 'rgba(255,255,255,0.07)' -draw "circle 900,40 900,300" \
    -fill "$CORAL" -draw "ellipse 560,520 170,120 0,360" \
    -fill 'rgba(255,214,102,0.95)' -draw "circle 600,90 600,112" \
    "$TMP/fg.png"

  magick assets/icon.png -resize 132x132 \
    \( -size 132x132 xc:black -fill white -draw "roundrectangle 0,0,131,131,30,30" \) \
    -alpha off -compose CopyOpacity -composite "$TMP/icon.png"

  phone "$SRC/02-dashboard.png" "$TMP/fg-phone.png" 330
  local pw ph
  pw=$(magick identify -format '%w' "$TMP/fg-phone.png")
  ph=$(magick identify -format '%h' "$TMP/fg-phone.png")
  local px=650 py=70

  magick "$TMP/fg.png" \
    \( -size ${fw}x${fh} xc:none -fill 'rgba(8,8,48,0.55)' \
       -draw "roundrectangle $px,$((py + 24)),$((px + pw)),$((py + ph + 24)),40,40" -blur 0x22 \) -composite \
    "$TMP/fg-phone.png" -geometry +${px}+${py} -composite \
    "$TMP/icon.png" -geometry +72+92 -composite \
    -font "$FONT_BOLD" -pointsize 88 -fill white -annotate +72+330 "Odova" \
    -font "$FONT_REG" -pointsize 34 -fill "$SUB_COLOR" -annotate +74+386 "Fuel & maintenance tracker" \
    -crop ${fw}x${fh}+0+0 +repage -alpha off -depth 8 -define png:color-type=2 "$out"
  echo "  $out"
}

echo "Rendering to $OUT"
feature_graphic
panel 01 "$SRC/02-dashboard.png"      dashboard      "Know your real\nfuel economy"     "Efficiency, spend and cost per km at a glance"
panel 02 "$SRC/03-add-fill.png"       log-fill-up    "Log a fill-up\nin seconds"        "Total cost worked out as you type"
panel 03 "$SRC/07-fill-history.png"   history        "Every fill-up\nin one place"      "A tidy history with cost and efficiency per tank"
panel 04 "$SRC/04-maintenance.png"    maintenance    "Never miss\na service"            "Oil changes, tyres and renewals, all tracked"
panel 05 "$SRC/05-add-reminder.png"   reminders      "Remind by date\nor odometer"      "Repeating reminders schedule themselves"
panel 06 "$SRC/06-vehicle-picker.png" multi-vehicle  "All your vehicles,\none garage"   "Switch between cars with a single tap"
panel 07 "$SRC/08-settings.png"       sync           "Your garage on\nevery device"     "Use a sync code or sign in. No account needed."
panel 08 "$SRC/01-onboarding.png"     get-started    "Start tracking\ntoday"            "Free, simple and private by default"
render_tablets 7-inch 1920 1080
render_tablets 10-inch 2560 1440
echo "Done."
