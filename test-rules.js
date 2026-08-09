const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const fs = require('fs');

async function main() {
  const testEnv = await initializeTestEnvironment({
    projectId: 'atelia-8acf2',
    firestore: {
      rules: fs.readFileSync('firestore.rules', 'utf8'),
    },
  });

  const alice = testEnv.authenticatedContext('alice');
  
  // Test reading users/alice
  console.log("Testing read users/alice...");
  try {
    await assertSucceeds(alice.firestore().doc('users/alice').get());
    console.log("SUCCESS!");
  } catch(e) {
    console.log("FAILED:", e.message);
  }

  // Test writing users/alice
  console.log("Testing write users/alice...");
  try {
    await assertSucceeds(alice.firestore().doc('users/alice').set({ email: "test" }));
    console.log("SUCCESS!");
  } catch(e) {
    console.log("FAILED:", e.message);
  }
  
  await testEnv.cleanup();
}

main().catch(console.error);
