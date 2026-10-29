/** What three.js's GLTFLoader turns a node name into: whitespace becomes "_" and the characters . [ ] : / are removed ("foot.l" -> "footl"). */
export const cleanNodeName = (name: string): string => name.replace(/\s/g, '_').replace(/[.[\]:/]/g, '');
