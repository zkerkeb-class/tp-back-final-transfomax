import express from 'express';
import pokemon from './schema/pokemon.js';
import {flatten}from 'flat';
import cors from 'cors';

import './connect.js';

const app = express();
app.use(cors());
app.use(express.json());  

app.get('/pokemons', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skipIndex = (page - 1) * limit;

    const pokemons = await pokemon.find().limit(limit).skip(skipIndex);
    const totalCount = await pokemon.countDocuments();
    const totalPages = Math.ceil(totalCount / limit);

    if (page > totalPages) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({
      data: pokemons,
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

    res.set('X-Is-Full-Art', 'true');
    
    res.sendFile(fullArtPath, { root: '.' }, (err) => {
      if (err) {
        console.log(`Full art not found for ID ${pokeId}, trying regular image.`);
        res.set('X-Is-Full-Art', 'false');
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

app.put('/pokemons/update', async (req, res) => {
  console.log('Received PUT request to /pokemons/update');
  try {
    const body = req.body;
    console.log('Received body for update:', body);


    if (!body.name) {
      return res.status(400).json({ error: "Donne au moins un nom je vais pas update dans le vide" });
    }

    console.log('Searching for Pokemon with name:', body.name);
    let newName = body.name.toLowerCase();
    newName = newName.charAt(0).toUpperCase() + newName.slice(1);
    const poke = await pokemon.findOne({ "name.french": newName });

    if (poke) {
      //update
      delete body.name;
      body['name.french'] = newName;
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

      const newPokemon = {
        id: newId,
        name: {
          french: newName
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
        image: body.image || "unknown.png"
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