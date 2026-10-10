# Append stumbles to a finished recording's caption and result: python3 addnotes.py NAME "note" ...
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
name, notes = sys.argv[1], sys.argv[2:]
md = os.path.join(here, '..', name + '.md')
t = open(md).read().rstrip('\n') + '\n'
if 'Stumbles seen while recording:' not in t:
    t += '\nStumbles seen while recording:\n\n'
t += ''.join('- ' + n + '\n' for n in notes)
open(md, 'w').write(t)
j = os.path.join(here, '.work', name + '.json')
d = json.load(open(j)); d['notes'] += notes; json.dump(d, open(j, 'w'), indent=2)
