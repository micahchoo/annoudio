#!/bin/sh
# Contact sheet of a GIF (12 frames) for a quick look: scripts/sheet.sh 02
f=$(ls "$(dirname "$0")"/../$1-*.webm | head -1)
n=$(ffprobe -v error -count_frames -select_streams v:0 -show_entries stream=nb_read_frames -of csv=p=0 "$f")
step=$(( n / 12 + 1 ))
mkdir -p "$(dirname "$0")/.work/frames"
ffmpeg -v error -y -i "$f" -vf "select='not(mod(n\,$step))',scale=iw*min(1\,640/iw):-1,tile=4x3" -frames:v 1 "$(dirname "$0")/.work/frames/$1.png"
echo "$(dirname "$0")/.work/frames/$1.png"
