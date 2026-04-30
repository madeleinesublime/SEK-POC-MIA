# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a single-file HTML wireframe/prototype for **SEK** (Svenska Elektriska Kommissionen), a Swedish B2B platform for purchasing standards, managing e-Standards subscriptions, and participating in committee work. The project name "SEK-POC-MIA" means Proof of Concept / Mockup in Action.

## Running the Project

No build system. Open `index.html` directly in a browser. All code lives in that one file.

## Architecture

Everything is in `index.html` (~11 600 lines): HTML structure, embedded `<style>` block, and embedded `<script>` block.

### View Routing

The app simulates navigation by toggling CSS visibility/display on named section elements. Each "page" is an `<section>` or `<div>` with an `id` matching a pattern like `*View` or `*Panel`. Navigation functions show the target view and hide all others. Sub-sections within My Pages and Committee pages use a nested tab panel pattern with similar show/hide logic.

Key top-level views:
- `homeView` — landing page
- `infoPageView` — "Delta & Påverka" content page
- `productPageView` / `productDetailView` — shop/product listing and detail
- `myPagesView` — authenticated user dashboard (sub-panels: overview, profile, orders, subscriptions, committees)
- Committee sub-panels — participants, meetings, documents, news, publications

### Design Tokens (CSS Variables)

Defined in `:root` at the top of the `<style>` block:

| Variable | Value | Usage |
|---|---|---|
| `--primary` | `#009bd9` | Cyan brand color |
| `--primary-dark` | `#1d3461` | Navy header/accents |
| `--copper` | `#B85C2E` | Secondary accent |
| `--text` | `#2f3135` | Body text |
| `--muted` | `#66707c` | Secondary text |

Spacing base unit is 8px. Border radius levels: `--radius-lg` 24px, `--radius-md` 8px, `--radius-sm` 12px.

### Key Interactive Patterns

- **Mobile search takeover**: overlay slides in from header search trigger
- **Account panel**: dropdown from avatar/login button in header
- **Login modal**: demo credential dialog, no real auth
- **Mega menu**: multi-column dropdown from main nav
- **Carousel**: touch/swipe-enabled, used for testimonials/quotes sections
- **Tab components**: ARIA-labeled tab lists controlling panel visibility

## Content Language

All UI text is in **Swedish**. Keep any new UI copy in Swedish.
