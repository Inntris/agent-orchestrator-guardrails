# Promptfoo Evidence Demo

Promptfoo is supporting evidence in this demo. It tests or rates risky AI output. Inntris turns that evidence into a required GitHub policy check and proof receipt.

Run the Promptfoo config if Promptfoo is installed:

```bash
promptfoo eval -c demo/promptfoo/promptfooconfig.yaml
```

Then run Inntris with the demo Promptfoo evidence files:

```bash
npm run demo:promptfoo:risky
npm run demo:promptfoo:safe
```

The product story remains Inntris:

- required GitHub Action check
- PASS/BLOCK decision
- verification receipt showing what happened and why
