# cp-lecture

Application web ludique pour apprendre à lire en CP (PC, tablette, téléphone), basée sur le fichier source :
https://monstresenclasse.fr/wp-content/uploads/2022/02/fichier-de-lecture-version-0222.pdf

## Fonctionnalités

- Suivi de l’avancement de l’élève (progression sauvegardée en local)
- Lecture à voix haute des énoncés et des textes (Web Speech API)
- Écoute de la prononciation et validation de lecture

## Lancer localement

```bash
cd /home/runner/work/cp-lecture/cp-lecture
python -m http.server 4173
```

Puis ouvrir `http://127.0.0.1:4173`.
