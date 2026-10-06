// Stands in for @anthropic-ai/sdk in the claude.ai build, where the frame cannot reach the API
// and the assistant uses the `sample` capability instead. Never called there.
export default class Anthropic {
  constructor() { throw new Error("The Claude API client is not available in this build."); }
}
export const betaZodOutputFormat = () => { throw new Error("unavailable"); };
