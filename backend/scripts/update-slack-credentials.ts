import prisma from '../src/config/database';

async function main() {
  console.log('Updating Slack configuration with full credentials...');

  // ⚠️ SECURITY WARNING: DO NOT hardcode credentials in code
  // Use the Web UI: System Settings > Notification Apps to configure tokens

  console.error('ERROR: This script should not be used.');
  console.error('Please use the Web UI to configure Slack credentials:');
  console.error('  1. Login as admin');
  console.error('  2. Go to System Settings > Notification Apps');
  console.error('  3. Add or update Slack configuration');
  console.error('\nNEVER commit tokens to Git!');
  return;

  // Legacy code - DO NOT USE
  /*
  const updated = await prisma.slackConfig.updateMany({
    where: { name: 'Main Workspace' },
    data: {
      appId: 'YOUR_APP_ID',
      clientId: 'YOUR_CLIENT_ID',
      clientSecret: 'YOUR_CLIENT_SECRET',
      signingSecret: 'YOUR_SIGNING_SECRET',
      verificationToken: 'YOUR_VERIFICATION_TOKEN',
      botToken: 'xoxb-YOUR_BOT_TOKEN',
      userToken: 'xapp-YOUR_USER_TOKEN',
      updatedAt: new Date(),
    },
  });
  */

  // Legacy code removed for security
}

main()
  .then(() => {
    console.log('\n✓ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
