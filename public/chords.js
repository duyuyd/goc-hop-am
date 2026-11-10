export function transpose(chord,shift=0){
 const sharps=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
 const flats=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
 const aliases={Db:1,Eb:3,Gb:6,Ab:8,Bb:10,Cb:11,Fb:4,'E#':5,'B#':0};
 return chord.replace(/(^|\/)([A-G][#b]?)/g,(_,prefix,note)=>{
  const index=aliases[note]??sharps.indexOf(note);
  const names=note.includes('b')?flats:sharps;
  return prefix+names[((index+shift)%12+12)%12];
 });
}
