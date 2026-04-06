db.createUser({
  user: 'libraryuser',
  pwd: 'librarypass',
  roles: [
    {
      role: 'readWrite',
      db: 'librarydb'
    }
  ]
});