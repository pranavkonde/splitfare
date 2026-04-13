#!/usr/bin/env node
/**
 * Generate STORACHA_KEY and STORACHA_PROOF for the SplitFare server agent.
 *
 * Usage:
 *   node scripts/generate-storacha-keys.mjs <your-email@example.com>
 *
 * After running:
 *   1. Check your email and click the verification link
 *   2. Select a payment plan (free Starter tier) if prompted
 *   3. The script will output STORACHA_KEY, STORACHA_PROOF, and STORACHA_SPACE_DID
 *   4. Paste these into your .env file
 */

import * as Client from '@storacha/client';
import { StoreMemory } from '@storacha/client/stores/memory';
import * as Ed25519 from '@ucanto/principal/ed25519';

const email = process.argv[2];

if (!email || !email.includes('@')) {
  console.error('');
  console.error('Usage: node scripts/generate-storacha-keys.mjs <your-email@example.com>');
  console.error('');
  process.exit(1);
}

async function main() {
  console.log('');
  console.log('═══════════════════════════════════════════════════');
  console.log('  Storacha Credential Generator for SplitFare');
  console.log('═══════════════════════════════════════════════════');
  console.log('');

  // Step 1: Generate a server agent key pair
  console.log('Step 1: Generating server agent key pair...');
  const serverSigner = await Ed25519.generate();
  const serverKey = Ed25519.format(serverSigner);
  const serverDid = serverSigner.did();
  console.log(`  ✓ Server Agent DID: ${serverDid}`);
  console.log('');

  // Step 2: Create a temporary client to login and create space
  console.log('Step 2: Logging in with email...');
  console.log(`  Sending verification email to: ${email}`);
  console.log('  ⏳ Please check your inbox and click the confirmation link...');
  console.log('');

  const tmpClient = await Client.create();

  try {
    const account = await tmpClient.login(email);
    console.log('  ✓ Email verified!');
    console.log('');

    // Wait for payment plan
    console.log('Step 3: Checking payment plan...');
    console.log('  If prompted in browser, select the free Starter plan.');
    try {
      await account.plan.wait();
      console.log('  ✓ Payment plan confirmed.');
    } catch {
      console.log('  ⚠ Could not verify plan (may already be set). Continuing...');
    }
    console.log('');

    // Step 3: Create a space
    console.log('Step 4: Creating space "splitfare-platform"...');
    let space;
    try {
      space = await tmpClient.createSpace('splitfare-platform', { account });
      console.log(`  ✓ Space created: ${space.did()}`);
    } catch (err) {
      // Space might already exist, try to use existing
      console.log(`  ⚠ Space creation issue: ${err.message}`);
      console.log('  Trying to use existing spaces...');
      const spaces = tmpClient.spaces();
      if (spaces.length > 0) {
        space = spaces[0];
        console.log(`  ✓ Using existing space: ${space.did()}`);
      } else {
        throw new Error('No spaces available. Please create one manually: npx @storacha/cli space create splitfare-platform');
      }
    }

    await tmpClient.setCurrentSpace(space.did());
    console.log('');

    // Step 4: Create delegation for the server agent
    console.log('Step 5: Creating delegation for server agent...');
    const audience = serverSigner;
    const abilities = [
      'space/blob/add',
      'space/index/add',
      'filecoin/offer',
      'upload/add',
      'space/blob/list',
      'upload/list',
    ];
    const expiration = Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 365 * 10); // 10 years

    const delegation = await tmpClient.createDelegation(audience, abilities, {
      expiration,
    });

    const archive = await delegation.archive();
    if (!archive.ok) {
      throw new Error('Failed to archive delegation');
    }

    // Convert to base64
    const proof = Buffer.from(archive.ok).toString('base64');
    console.log('  ✓ Delegation created and serialized.');
    console.log('');

    // Output
    console.log('═══════════════════════════════════════════════════');
    console.log('  Add these to your .env file:');
    console.log('═══════════════════════════════════════════════════');
    console.log('');
    console.log(`STORACHA_KEY=${serverKey}`);
    console.log('');
    console.log(`STORACHA_PROOF=${proof}`);
    console.log('');
    console.log(`STORACHA_SPACE_DID=${space.did()}`);
    console.log('');
    console.log('═══════════════════════════════════════════════════');
    console.log('  ⚠ Keep these values secret!');
    console.log('  ✓ Done! Paste the values above into .env and restart your dev server.');
    console.log('═══════════════════════════════════════════════════');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error:', error.message);
    console.error('');
    console.error('If email verification timed out, try again.');
    console.error('If you need help, visit: https://docs.storacha.network/how-to/create-account/');
    process.exit(1);
  }
}

main();
