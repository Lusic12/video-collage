"""Re-export the main and supplementary qualitative results from the paper."""
from pathlib import Path
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PAPER_CANDIDATES = (ROOT / 'AI4Love/AI4Love', ROOT.parent / 'AI4Love')
PAPER = next((path for path in PAPER_CANDIDATES if (path / 'experiment.tex').exists()), PAPER_CANDIDATES[0])
# title, heading, story, look. The story retells only what the selected
# keyframes show; (NN) marks the keyframe a clause refers to.
COPY = {
 'Your_name': ('Your Name', 'Two lives, one composition.',
  'A girl stands apart in a crowd (01). She and a boy meet back to back (02), and a red cord loops between them (03–04), then stretches thin as they are pulled apart (05–06). A boy stands in a crowd of his own (07) and, last, on a city street (08).',
  'Four of the eight frames show the red cord (03–06). Find where they sit inside the heart.'),
 '10_Lives': ('10 Lives', 'A character, across changing moments.',
  'A cat sprawls on a patterned rug (01–02) while a van pulls up outside (03). It looks up, alert (04). A man in glasses appears at the door (05–06), the cat settles on a stack of pizza boxes (07), and the clip ends with two people indoors (08).',
  'The cat changes pose and place in almost every frame. Check which of its appearances keep the whole body in the cell.'),
 'Cat': ('Cat', 'Small reactions carry the scene.',
  'An orange cat in a hat is offered a blue bottle (01–02) and a grey-haired woman leans in (03). The cat peers over a ledge (04), tumbles through the dark (05), and a small figure leaps against the sky (06). It ends beside a black cat in a yellow hood (07–09).',
  'The source is letterboxed, and the black bars are carried into several cells of the collage.'),
 'Garfield': ('Garfield', 'An encounter, told through expressions.',
  'Late at night, a tiny orange kitten sits alone on a box, as if someone has left it behind. Its eyes are wide and searching, and for a moment it lowers them, giving up (01–02). Then a man notices it and kneels down on the empty street (03). The kitten looks up at him, pleading, as he cups it in both hands (04). He lifts it toward his face (05); it stares back, still unsure whether to trust him (06). He holds it close, and it is no longer alone (07).',
  'Close-ups of the kitten alternate with shots of the man. The near-identical close-ups (01, 02, 04, 06) each keep their own cell.'),
 'House_of_Magic': ('House of Magic', 'From a window ledge to a wider world.',
  'An old magician holds an orange kitten (01). A purple shape sprawls on a staircase (02) and children look out of a window (03). The kitten edges along a high ledge (04–06), clings on in close-up (07), and the clip ends in a red-lit hall (08–09).',
  'Three ledge frames (04–06) differ only in the pose of the kitten. See how much of the ledge each cell keeps.'),
 'Imaginary': ('Imaginary', 'A journey across imagined spaces.',
  'Earth is seen from a small moon (01). A figure streaks through teal currents (02–04), a star-shaped box rests on a table (05), two boys run past a car (06) and ride a flying car through the clouds (07–08). A blond boy looks up, startled (09); the last frame is a dim, cluttered room (10).',
  'The source is letterboxed, and the black bars are carried into the cells of the collage.'),
 'Secret_Life_Of_Pets': ('The Secret Life of Pets', 'Many characters, a shared canvas.',
  'A grey cat is fed in a kitchen (01–02) and a pug waits by a door (03–04). Pets crowd a living room around a television (05), a green bird flies at the camera (06), a roast chicken sits in an open fridge until the cat appears beside it (07–08), and an animal clings to an autumn tree outside the windows (09–10).',
  'Ten frames with a different animal in almost each one. Count how many you can still identify in the collage.'),
 'Dog_tale': ('Dog Tale', 'A familiar character through a sequence.',
  'A small dog stands in a hallway (01) and sits on a step (02). A man on a sofa works on a purple garment (03). The dog then sits wearing a purple sweater (04–06) and ends up lying on a blanket (07).',
  'Live action. The source frames carry burned-in subtitles (03, 05, 07), which remain readable in some cells.'),
 'Our_Days': ('Our Days', 'Everyday moments, held together.',
  'A grey rabbit rests in its hay tray (01), sits on a wooden hut (02) and explores its pen (03–04). A person kneels on a green rug and feeds it by hand (05–07). The last frame shows the rabbit alone on the rug (08).',
  'Live action. The rabbit is small in the wide shots (03, 04, 08). Check whether it stays visible in those cells.'),
 'Luca': ('Luca', 'Friendship in motion.',
  'Two boys watch the lights across the water at dusk (01). By day they trade looks over a handmade board (02), cheer on a wooden deck (03), brace together on a scooter, one in a colander helmet (04–05), face a plank ramp over the sea (06) and fly off into the sky (07).',
  'Frame 01 comes from a trailer title card, so part of its caption text is visible in the top cell.'),
 'Chococat': ('Chococat', 'A small cast, one bright sequence.',
  'Chococat stands between friends in a garden as they hold an orange cord (01). Against a purple backdrop, the group shifts and another character joins them (02). The scene moves outdoors again, bringing Chococat and its friends together (03). A close-up isolates Chococat’s wide eyes (04). Hello Kitty and Chococat appear side by side (05), then the orange cord stretches between the group once more (06).',
  'The clip alternates group shots with close-ups. Follow how the orange cord connects the opening and closing moments.'),
}
METHODS = ['ours', 'iscp', 'colla', 'sc']
# Google Drive file IDs for the original input clips in the shared video folder.
INPUT_VIDEOS = {
 '10_Lives': '11gg5AQOZQTZnuXId1l5R5iDPNPKWQZiN',
 'Luca': '1IMJSNjsZKQD5x_Olqydv722v9glIBsQJ',
 'Chococat': '1iVAkjwIYDL1owhcARiOYkSg7-s5lm6xq',
 'Garfield': '1Mu3JFQIbuZy_Ytu6vBOeSOxNSikjvN4Q',
 'House_of_Magic': '13Fsgn7P0Tz8QhgIYNdMqhUVzQ8ETZtTU',
 'Cat': '1PzToxGonGz6TNKxH4RxUMddlwXRbSDKX',
 'Imaginary': '1oaZNaLlfKnNCODi4RDopsPI-UN2d-DG6',
 'Secret_Life_Of_Pets': '1EI3nOt1F3p9fKzYSP7japF_OzHG_SZ4A',
 'Your_name': '18H63-j0gQA6W3heSvgeL0WKnM7x7NCxI',
 'Dog_tale': '11gE8S79VmKFEl9dKv4kzVkO3WEh9UkCi',
 'Our_Days': '10bqyFjBBEZErBDzXZVJFu7cAqJX6xFDI',
}

def preview(source, destination, size):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['sips','-Z',str(size),str(source),'--out',str(destination)],check=True,capture_output=True)
    return str(destination.relative_to(ROOT))

if not PAPER.exists():
    raise SystemExit('The paper sources (AI4Love/) are not here. The page only needs assets/results and assets/results.json; edit that file directly.')
paper_figures = '\n'.join(
    (PAPER / source).read_text()
    for source in ('images/experiment/comparisons_main.tex', 'images/experiment/comparisons_supp.tex')
)
# Preserve the main-paper figure order, then append supplementary-only clips.
order = ['10_Lives', 'Luca', 'Chococat', 'Garfield', 'House_of_Magic',
         'Cat', 'Imaginary', 'Secret_Life_Of_Pets', 'Your_name', 'Dog_tale', 'Our_Days']
results=[]
for name in order:
    title, heading, story, look = COPY[name]
    slug = name.lower().replace('_', '-')
    out = ROOT / 'assets/results' / slug
    (out/'keyframes').mkdir(parents=True, exist_ok=True)
    sources = re.findall(r'\\AVKF\{(images/method/KEYFRAME_FILTER/'+re.escape(name)+r'/[^}]+)\}', paper_figures)
    if not sources: raise ValueError(f'No paper keyframes for {name}')
    frames=[]
    for i, rel in enumerate(sources):
        src = PAPER / rel
        dest = out/'keyframes'/src.name
        shutil.copy2(src,dest)
        number = re.search(r'frame_(\d+)',src.name).group(1)
        frames.append({'src':str(dest.relative_to(ROOT)), 'frame':int(number), 'order':i+1})
    outputs={}
    for method in METHODS:
        source = PAPER / f'images/comparison/final/{method}/{name}.png'
        destination = out/f'{method}.png' if method in ('ours','sc') else out/'comparison'/f'{method}.png'
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source,destination)
        outputs[method]=str(destination.relative_to(ROOT))
    comparison={method:outputs.pop(method) for method in ['iscp','colla']}
    thumb=preview(out/'ours.png', out/'thumb.png', 240)
    results.append({'id':slug,'title':title,'category':'Live action' if name in ['Dog_tale','Our_Days'] else ('Anime' if name in ['Your_name','Imaginary'] else 'Animation'),'heading':heading,'story':story,'look':look,'thumb':thumb,'keyframes':frames,'outputs':outputs,'comparison':comparison,'inputVideo':INPUT_VIDEOS[name],'paperLabel':'fig_comparison','keyframeLabel':'Keyframes shown in the paper'})
# The extra examples no longer have a separate source: their files live in
# assets/results/more and their entries are kept as they are.
more=json.loads((ROOT/'assets/results.json').read_text()).get('more', [])
(ROOT/'assets/results.json').write_text(json.dumps({'results':results,'more':more},ensure_ascii=False,indent=2)+'\n')
shutil.copy2(PAPER/'images/method/framework.jpg',ROOT/'assets/results/framework.jpg')
print(f'Exported {len(results)} paper results, {sum(len(x["keyframes"]) for x in results)} keyframes and {len(more)} extra examples.')
