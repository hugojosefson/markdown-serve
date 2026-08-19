# Agent instructions

## Server root

Run the server from the current working directory (the repository) by default.
Never start it from the user's home directory or any path outside the
repository, except when a specific task requires testing that exact root (for
example, reproducing a bug about which directories are listed).
