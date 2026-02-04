import express from 'express';
import pokemon from './schema/pokemon.js';
import {flatten}from 'flat';

import './connect.js';

const app = express();
app.use(express.json());

app.get('/', (req, res) => {
  res.send('Hello, World!');
});

app.get('/pokemons', async (req, res) => {
  try {
    const pokemons = await pokemon.find().limit(20);
    res.json(pokemons);
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