// DEPLOY_STANDALONE=1 builds a self-contained server (server.js) for Plesk/Passenger hosting.
export default {
  distDir:process.env.NEXT_OUTPUT_DIR || '.next',
  // Hides the round Next.js badge in development; it covered the first button of the phone menu. Errors still show.
  devIndicators:false,
  ...(process.env.DEPLOY_STANDALONE ? {output:'standalone'} : {}),
}
