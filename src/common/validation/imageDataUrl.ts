/**
 * Fotos, logos e capas trafegam como data URL dentro do JSON, já reduzidas no
 * navegador. Texto vazio significa "remover a imagem".
 */
export const IMAGE_DATA_URL_PATTERN =
  /^$|^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/;

/** Teto por imagem: a capa de 1600×480 em JPEG fica bem abaixo disso. */
export const IMAGE_DATA_URL_MAX_LENGTH = 2_000_000;

/** `''` remove a imagem; o banco guarda `null` em vez de string vazia. */
export function toStoredImage(value: string): string | null {
  return value === '' ? null : value;
}
