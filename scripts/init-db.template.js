try {
  print('Creating new user:', '${MONGO_USERNAME}');
  db.createUser({ user: '${MONGO_USERNAME}', pwd: '${MONGO_PASSWORD}', roles: [{ role: 'readWrite', db: '${MONGO_INITDB_DATABASE}' }] });
} catch (error) {
  print('Error creating user:', error.message);
}

const collections = ['users', 'warnings', 'reports', 'bans', 'settings', 'rules', 'statistics', 'logs'];

collections.forEach((collection) => {
  if (!db.getCollectionNames().includes(collection)) {
    print('Creating collection:', collection);
    db.createCollection(collection);
  } else {
    print('Collection already exists:', collection);
  }
});
