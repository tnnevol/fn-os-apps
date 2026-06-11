import {
  defineConfig,
  presetWind3,
  transformerDirectives,
  transformerVariantGroup,
} from "unocss";

export default defineConfig({
  presets: [presetWind3()],
  transformers: [transformerDirectives(), transformerVariantGroup()],
  outputToCssLayers: false,
  layers: {
    default: 0,
    utilities: 0,
    preflights: 0,
  },
});
