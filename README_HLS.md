# HLS Viewer - 100ms Integration

Ce projet intègre le lecteur HLS de 100ms pour visionner des streams en temps réel.

## Fonctionnalités

- ✅ Lecteur HLS avec le SDK `@100mslive/hls-player`
- ✅ Proxy Next.js pour contourner les erreurs CORS
- ✅ Interface de contrôle (play/pause, volume, qualité)
- ✅ Support des différentes qualités HLS disponibles
- ✅ Détection du statut live/non-live

## Utilisation

### Démarrage rapide

1. Installez les dépendances :
```bash
npm install
# ou
bun install
```

2. Lancez le serveur de développement :
```bash
npm run dev
# ou
bun dev
```

3. Ouvrez http://localhost:3000/hls

### Utilisation

1. **Avec une URL de meeting 100ms** :
   - Collez l'URL de meeting 100ms (ex: `https://liveshopping.app.100ms.live/streaming/meeting/ROOM_ID`)
   - Cliquez sur "Charger le flux"

2. **Avec un Room ID** :
   - Entre le Room ID directement (ex: `yxj-ztjx-mxy`)
   - Cliquez sur "Charger le flux"

## Configuration avancée

Pour une intégration complète avec l'API 100ms (génération de tokens, etc.), ajoutez vos identifiants dans un fichier `.env` :

```env
# Optionnel: nécessaires pour générer des tokens et rejoindre des rooms
HMS_MANAGEMENT_TOKEN=votre_token
HMS_APP_SECRET=votre_secret
```

## Architecture

### Fichiers principaux

- `src/app/hls/page.tsx` - Composant principal du lecteur
- `src/app/api/hls-proxy/route.ts` - Proxy pour les fichiers HLS (évite CORS)
- `src/app/api/hms-token/route.ts` - API pour générer les tokens 100ms
- `next.config.ts` - Configuration Next.js avec rewrites

### Technologies utilisées

- **Next.js 16** - Framework React
- **@100mslive/hls-player** - SDK lecteur HLS officiel 100ms
- **@100mslive/react-sdk** - SDK React pour 100ms
- **TypeScript** - Typage statique

## Notes importantes

⚠️ Pour que le lecteur fonctionne correctement :
1. Le meeting doit avoir HLS activé dans 100ms
2. Le stream doit être en cours
3. L'URL de meeting doit être valide

## Documentation

- [100ms HLS Player Documentation](https://www.100ms.live/docs/javascript/v2/how-to-guides/record-and-live-stream/hls/hls-player)
- [100ms React SDK Documentation](https://www.100ms.live/docs/javascript/v2/foundation/quickstart/)

