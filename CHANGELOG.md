# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## Unreleased

### Added

- `Reveal Current Userdata` command and menu action to open the current userdata
  directory in the system file manager.
- GitHub Actions CI for check, test, build, VSIX packaging, and packaging
  verification.

### Changed

- README is now user-facing only, with development and maintainer guidance moved
  to `CONTRIBUTING.md`.
- README now leads with Cursor vs VS Code positioning and explains when native
  Profiles are enough versus when isolated userdata is needed.
- Marketplace metadata: description, keywords, and Q&A routing.
- VSIX packaging excludes CI workflow files, contributing docs, and build
  config.

## 0.2.0

### Added

- Compact status bar and clearer Userdata Menu actions.
- Command categories for cleaner Command Palette grouping.
- Typed menu intent handling internally.
- Package metadata and Marketplace-ready README assets.

## 0.1.2

### Added

- Named userdata launch flows for supported VS Code-family editors.
- Current userdata detection for the active window.
- Managed userdata creation and rename flows.
- Shared extensions directory handling for managed userdata launches.
