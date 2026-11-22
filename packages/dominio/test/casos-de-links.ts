/* eslint-disable no-script-url -- os casos de teste incluem javascript: de propósito: a regra tem de recusá-lo */
/**
 * Os mesmos casos rodam no domínio (`links-de-musica.test.ts`) e contra `uj.link_de_musica_valido`
 * no banco (`apps/api/test/banco/links-da-musica.test.ts`): a regra do app e a do banco não divergem.
 */
import { MAXIMO_DO_ENDERECO_DO_LINK } from '../src/index.ts'

export const LINKS_ACEITOS: readonly [string, 'youtube' | 'drive'][] = [
  ['https://www.youtube.com/watch?v=abc123', 'youtube'],
  ['https://youtube.com/watch?v=abc123', 'youtube'],
  ['https://m.youtube.com/watch?v=abc123', 'youtube'],
  ['https://music.youtube.com/watch?v=abc123', 'youtube'],
  ['https://youtu.be/abc123', 'youtube'],
  ['https://youtu.be', 'youtube'],
  ['HTTPS://YouTu.be/abc123', 'youtube'],
  ['https://drive.google.com/file/d/1AbC/view?usp=sharing', 'drive'],
  ['https://drive.google.com/drive/folders/1AbC', 'drive'],
  ['https://docs.google.com/document/d/1AbC/edit', 'drive'],
  ['https://docs.google.com/presentation/d/1AbC#slide=id.p', 'drive'],
  ['  https://youtu.be/abc123  ', 'youtube'],
]

export const LINKS_RECUSADOS: readonly string[] = [
  '',
  'youtu.be/abc123',
  'http://youtu.be/abc123',
  'javascript:alert(1)',
  'data:text/html;base64,PHNjcmlwdD4=',
  'ftp://drive.google.com/x',
  'file:///etc/passwd',
  'https://exemplo.test/musica',
  'https://youtube.com.evil.test/x',
  'https://evil.test/https://youtu.be/x',
  'https://youtu.be.evil.test',
  'https://notyoutube.com/x',
  'https://sites.google.com/x',
  'https://google.com/x',
  'https://user:senha@youtu.be/x',
  'https://youtu.be@evil.test/x',
  'https://evil.test@youtu.be/x',
  'https://youtu.be:8443/x',
  'https://youtu.be\\evil.test/x',
  'https://youtu.be/com espaço',
  'https://youtu.be/x\ny',
  'https://youtu.be/x\u0007',
  `https://youtu.be/${'a'.repeat(MAXIMO_DO_ENDERECO_DO_LINK)}`,
]
