import os, urllib.request
os.makedirs('dist', exist_ok=True)
THREE_URL = 'https://unpkg.com/three@0.158.0/build/three.min.js'
if not os.path.exists('three.min.js'):
    print('Downloading three.js r158 ...')
    urllib.request.urlretrieve(THREE_URL, 'three.min.js')
import os
src='src'
html=open(f'{src}/index.html').read()
three=open('three.min.js').read()
game='\n'.join(open(f'{src}/{f}').read() for f in ['core.js','world.js','robot.js','entities.js','story.js','ui.js','game.js'])
html=html.replace('<script>/*THREE*/</script>','<script>'+three+'</script>').replace('<script>/*GAME*/</script>','<script>\n'+game+'\n</script>')
os.makedirs('dist',exist_ok=True)
open('dist/index.html','w').write(html)
print(len(html))
