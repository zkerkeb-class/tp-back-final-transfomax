import express from 'express';
import pokemon from './schema/pokemon.js';
import {flatten}from 'flat';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import multer from 'multer';

import './connect.js';

const app = express();
app.use(cors());
app.use(express.json());  

// Multer config for image uploads
const uploadDir = 'assets/pokemons';
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, 'tmp_' + Date.now() + path.extname(file.originalname))
});
const upload = multer({ storage });

app.get('/pokemons', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skipIndex = (page - 1) * limit;

    const pokemons = await pokemon.find().limit(limit).skip(skipIndex).lean();

    const enrichedPokemons = pokemons.map(p => {
        const fullArtPath = `assets/pokemons/full-art/${p.id}.png`;
        
        const isFullArt = fs.existsSync(fullArtPath);

        return {
            ...p,
            isFullArt: isFullArt
        };
    });

    const totalCount = await pokemon.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);

    if (page > totalPages) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      data: enrichedPokemons,
      meta: {
        total: totalCount,
        currentPage: page,
        totalPages: totalPages
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
})

app.get('/pokemons/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) {
      return res.json({ data: [] });
    }

    const regex = new RegExp(q, 'i');
    const results = await pokemon.find({ "name.french": { $regex: regex } }).lean();
    res.json({ data: results });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/pokemons/:name', async (req, res) => {
  try {
    // On met la premiere lettre en maj comme dans la bdd
    let pokeName = req.params.name.toLowerCase();
    pokeName = pokeName.charAt(0).toUpperCase() + pokeName.slice(1);
    console.log('Searching for Pokemon:', pokeName);
    const poke = await pokemon.findOne({ "name.french": pokeName });
    if (poke) {
      res.json(poke);
    } else {
      res.status(404).json({ error: 'Pokemon not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/assets/pokemons/:id', async (req, res) => {
  try {
    const pokeId = parseInt(req.params.id);
    console.log('Searching for Pokemon with ID:', pokeId);

    const fullArtPath = `assets/pokemons/full-art/${pokeId}.png`;
    const imagePath = `assets/pokemons/${pokeId}.png`;

    
    res.sendFile(fullArtPath, { root: '.' }, (err) => {
      if (err) {
        console.log(`Full art not found for ID ${pokeId}, trying regular image.`);
        res.sendFile(imagePath, { root: '.' }, (err2) => {
          if (err2) {
            console.log(`No image found for ID ${pokeId}`);
            res.status(404).json({ error: 'Pokemon image not found' });
          }
        });
      }
    });
    
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/assets/types/:type', async (req, res) => {
  try {
    const type = req.params.type.toLowerCase();
    console.log('Searching for typePokemon with type:', type);
    const imagePath = `assets/types/${type}.png`;
    if (imagePath) {;
      res.sendFile(imagePath, { root: '.' });
    } else {
      res.status(404).json({ error: 'Type not found' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.put('/pokemons/update', upload.single('image'), async (req, res) => {
  console.log('Received PUT request to /pokemons/update');
  try {
    const body = { ...req.body };
    console.log('Received body for update:', body);

    // Parse JSON string fields sent via FormData
    if (typeof body.type === 'string') {
      try { body.type = JSON.parse(body.type); } catch (e) { body.type = body.type.split(',').map(t => t.trim()); }
    }
    if (typeof body.base === 'string') {
      try { body.base = JSON.parse(body.base); } catch (e) { body.base = {}; }
    }

    const normalizeName = (value) => {
      if (!value) return '';
      let normalized = value.toLowerCase();
      return normalized.charAt(0).toUpperCase() + normalized.slice(1);
    };

    const searchNameRaw = body.originalName || body.name;
    const desiredNameRaw = body.newName || body.name;

    if (!searchNameRaw) {
      return res.status(400).json({ error: "Donne au moins un nom je vais pas update dans le vide" });
    }

    const searchName = normalizeName(searchNameRaw);
    const desiredName = normalizeName(desiredNameRaw);

    console.log('Searching for Pokemon with name:', searchName);
    const poke = await pokemon.findOne({ "name.french": searchName });

    // Helper: move uploaded file to assets/pokemons/{id}.png and return the public URL
    const saveImage = (pokeId) => {
      if (!req.file) return null;
      const destPath = path.join(uploadDir, `${pokeId}.png`);
      fs.renameSync(req.file.path, destPath);
      return `http://localhost:3000/assets/pokemons/${pokeId}.png`;
    };

    if (poke) {
      //update
      delete body.name;
      delete body.originalName;
      delete body.newName;
      body['name.french'] = desiredName;

      const imageUrl = saveImage(poke.id);
      if (imageUrl) body.image = imageUrl;

      const updateData = flatten(body, { safe: true });
      console.log("body pour update:", body);

      const updatedPoke = await pokemon.findOneAndUpdate(
        { id: poke.id },
        { $set: updateData },
        { new: true, runValidators: true }
      );
      res.status(200).json(updatedPoke);

    } else {
      // create
      const newId = await pokemon.countDocuments() + 1;

      const imageUrl = saveImage(newId);

      const newPokemon = {
        id: newId,
        name: {
          french: desiredName
        },
        type: body.type || ["unknown"],
        base: {
          HP: body.base?.HP || 0,
          Attack: body.base?.Attack || 0,
          Defense: body.base?.Defense || 0,
          SpecialAttack: body.base?.SpecialAttack || 0,
          SpecialDefense: body.base?.SpecialDefense || 0,
          Speed: body.base?.Speed || 0
        },
        image: imageUrl || "unknown.png"
      };

      const createdPoke = await pokemon.create(newPokemon);
      res.status(201).json(createdPoke);
    }

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.delete('/pokemons/delete', async (req, res) => {
  try {
    let pokeName = req.body.name.toLowerCase();
    pokeName = pokeName.charAt(0).toUpperCase() + pokeName.slice(1);
    const deletedPoke = await pokemon.findOneAndDelete({ "name.french": pokeName });
    if (deletedPoke) {
      res.json({ message: 'Pokemon deleted successfully' });
    } else {
      res.status(404).json({ error: 'Pokemon not found' }); 
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

console.log('Server is set up. Ready to start listening on a port.');

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});