/** Baixa um arquivo gerado no navegador (PDF) ou recebido da API (Excel). */
export function salvarArquivo(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Nome do arquivo no cabeçalho Content-Disposition (aceita filename*=UTF-8''…). */
export function nomeDoArquivo(cabecalho: string | null, padrao: string): string {
  const utf8 = cabecalho?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (utf8) return decodeURIComponent(utf8);
  return cabecalho?.match(/filename="?([^";]+)"?/i)?.[1] ?? padrao;
}
