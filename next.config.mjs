// DEPLOY_STANDALONE=1 builds a self-contained server (server.js) for Plesk/Passenger hosting.
export default {
  distDir:process.env.NEXT_OUTPUT_DIR || '.next',
  ...(process.env.DEPLOY_STANDALONE ? {output:'standalone'} : {}),
}
