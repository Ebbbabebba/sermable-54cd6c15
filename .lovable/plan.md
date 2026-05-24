Sätt `#17C7D9` (HSL `187 81% 47%`) som app-bakgrund i båda temana via `src/index.css`.

### Ändringar

**`src/index.css` — `:root` (dark/default):**
```
--background: 187 81% 47%;
--foreground: 0 0% 100%;
```

**`src/index.css` — `.light`:**
```
--background: 187 81% 47%;
--foreground: 0 0% 100%;
```

### Notering

Stark turkos som hela appens bakgrund gör att vita kort/komponenter får mycket kontrast, men text direkt mot bakgrunden kommer behöva vit färg. Vi sätter därför `--foreground` till vit i båda lägena. Övriga tokens (cards, primary, etc.) lämnas orörda — `--card` är fortfarande vit/mörk så innehåll förblir läsbart.

Om du senare vill mjuka upp det (t.ex. ljus turkos `#E5F8FB` som bakgrund och `#17C7D9` som primary istället) säg till så byter vi.