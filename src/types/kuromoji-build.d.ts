// El bundle de navegador de @aiktb/kuromoji (usa BrowserDictionaryLoader, sin `fs`).
// Reutiliza los tipos publicados del paquete.
declare module "@aiktb/kuromoji/build/kuromoji.js" {
  import type {
    TokenizerBuilder,
    IpadicFeatures,
    TokenizerBuilderOption,
  } from "@aiktb/kuromoji";

  const kuromoji: {
    builder(option: TokenizerBuilderOption): TokenizerBuilder<IpadicFeatures>;
  };
  export default kuromoji;
}
