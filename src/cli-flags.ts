/**
 * CLI Flags Parser
 *
 * This module parses command line flags for the NexureJS application.
 */

// Define the flags and their default values
export interface CliFlags {
  // Force use of JavaScript implementation even if native is available
  forceJs: boolean;

  // Display verbose output for debugging
  verbose: boolean;

  // Display the version number and exit
  version: boolean;

  // Display help information and exit
  help: boolean;
}

// Parse the command line arguments
export function parseCliFlags(args: string[] = process.argv.slice(2)): CliFlags {
  const flags: CliFlags = {
    forceJs: process.env.NEXURE_FORCE_JS === 'true',
    verbose: process.env.NEXURE_VERBOSE === 'true',
    version: false,
    help: false
  };

  // Process each argument
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    switch (arg) {
      case '--force-js':
      case '--js':
        flags.forceJs = true;
        break;

      case '--verbose':
      case '-v':
        flags.verbose = true;
        break;

      case '--version':
      case '-V':
        flags.version = true;
        break;

      case '--help':
      case '-h':
        flags.help = true;
        break;

      default:
        // Ignore unknown arguments
        break;
    }
  }

  return flags;
}

// Helper function to display help information
export function displayHelp(): void {
  console.log(`
NexureJS - A high-performance JavaScript framework

USAGE:
  node <your-app.js> [OPTIONS]

OPTIONS:
  --force-js, --js      Force use of JavaScript implementation even if native is available
  --verbose, -v         Display verbose output for debugging
  --version, -V         Display the version number and exit
  --help, -h            Display this help information and exit
`);
}

// Helper function to display the version
export function displayVersion(version: string): void {
  console.log(`NexureJS v${version}`);
}

// Parse the flags on module load
export const flags = parseCliFlags();
