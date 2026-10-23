// Um deploy sem estes arquivos deixa a prancheta e os agentes invisíveis.
import { readFileSync } from 'node:fs';
const mapas = ['ascent', 'breeze', 'fracture', 'haven', 'lotus'];
const banners = ['abyss', 'ascent', 'bind', 'breeze', 'corrode', 'fracture', 'haven', 'icebox', 'lotus', 'pearl', 'split', 'summit', 'sunset'];
const arquivos = ['paredes.json', 'agentes.png', 'habilidades.png',
  ...mapas.flatMap(m => ['ataque', 'defesa'].map(l => `mapas/${m}-${l}.svg`)),
  ...banners.map(m => `banners/${m}.webp`)];
for (const nome of arquivos) {
  const arquivo = readFileSync(new URL('../public/arte/prancheta/' + nome, import.meta.url));
  if (!arquivo.length) throw new Error(`Arte vazia: ${nome}`);
  if (nome.endsWith('.json')) JSON.parse(arquivo.toString());
  if (nome.endsWith('.svg') && !arquivo.toString().includes('<svg')) throw new Error(`SVG inválido: ${nome}`);
  if (nome.endsWith('.png') && arquivo.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`PNG inválido: ${nome}`);
  if (nome.endsWith('.webp') && arquivo.subarray(8, 12).toString() !== 'WEBP') throw new Error(`WebP inválido: ${nome}`);
}
console.log(`Artes verificadas: ${arquivos.length} arquivos obrigatórios presentes.`);
