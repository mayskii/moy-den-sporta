# My Workout Day

A simple, free phone web app for daily exercise: check off what you did today, aim for at least 3 exercises a day, and see your progress on a color calendar.

**Live:** https://mayskii.github.io/moy-den-sporta/ (works best on a phone; you can add it to your home screen)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/screens-dark.png">
  <img alt="Today, Calendar, Streak and Stats screens of My Workout Day" src="docs/screens-light.png">
</picture>

<sub>Screens with demo data. The app has light and dark themes and follows your phone's setting.</sub>

## Why

Almost every workout app I found wanted a paid subscription. I wanted something simple and free that I could use every day and share with others. No sign-up, no ads, no subscription.

## What it does

- **Today:** your exercise list as a checklist, with a progress ring toward the daily goal
- **Calendar:** each day colored by how it went: goal reached, some done, or nothing
- **Streak:** current and best streak, and the last 7 days
- **Stats:** share of days with the goal reached, how often each exercise was done, the last 8 weeks
- **Settings:** change the daily goal, add, rename, reorder, remove and restore exercises
- **Backup:** save all your data to a file and restore it later
- Light and dark themes; calendar colors chosen to stay distinct for colorblind users

## Privacy

Your data stays only in your own browser (localStorage) and is never sent anywhere. The app loads nothing from other servers: even the font ([Onest](https://github.com/googlefonts/onest), SIL Open Font License) is included in `fonts/`. Because the data lives in the browser, use **Backup** before clearing site data or changing phones.

## How I built it with Claude

I built this app during Anthropic's AI Fluency course, using Claude Code for the code and Claude Design for one screen.

1. **Plan first.** Before any code, I planned the project with Claude. Its questions made me imagine real use, and that changed the main rule: not "finish the whole list every day," but "at least 3 exercises." I decided what stays with me (what the app does, judging it on my phone) and what Claude does (drafts, code, explanations).
2. **Small steps.** Today screen → calendar → stats → settings and backup → streak. One step at a time, each one a separate commit.
3. **Check after every step.** I tested each step on my phone and on a large screen, and asked Claude to explain each piece of code until I understood it. Claude's code looked right but had bugs: hidden tabs still showed, and the bottom of long tabs was cut off under the tab bar. I caught both by testing.
4. **Design, then build.** The Streak tab was first sketched in Claude Design, then built in Claude Code with the app's own colors so it works in both themes.

**What I learned:** the more clearly I describe what I want, including how I will test it, the less Claude has to guess. Checking the result is harder than describing the task, and every check makes the next description better. Some things did not go to plan: building it "in an hour" was unrealistic, and file backup didn't work inside a Claude artifact, so I moved the project to my own files and GitHub Pages.

## What's next

This is only the beginning. Next, I want to give the app to a few people, listen to what is confusing or missing, and improve it based on their feedback, keeping it free.

## Tech

Plain HTML, CSS and JavaScript (`index.html`, `style.css`, `app.js`): no frameworks and no build step. Hosted on GitHub Pages.

**Lighthouse** (live site, mobile, October 2026): Performance 100 · Accessibility 100 · Best Practices 100 · SEO 100. On a simulated mid-range phone with slow 4G, the main content appears in 1.2 s.

To run it locally, open `index.html` in a browser, or start a small server:

```bash
python3 -m http.server
```

Then open http://localhost:8000.
