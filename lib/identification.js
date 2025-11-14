const axios = require('axios');
const FormData = require('form-data');

async function identifyImageWithINat(imageBuffer) {
  const apiToken = process.env.INATURALIST_API_TOKEN;
  if (!apiToken) throw new Error('INATURALIST_API_TOKEN is not configured');

  const form = new FormData();
  form.append('image', imageBuffer, { filename: 'image.jpg' });

  const response = await axios.post("https://api.inaturalist.org/v1/computervision/score_image?locale=en&preferred_place_id=1", form, {
    headers: { 'Authorization': apiToken, ...form.getHeaders() },
  });

  const data = response.data;
  const topResult = data.results?.[0];
  let formattedContent;

  if (!topResult) {
    formattedContent = "Could not identify the bird from the image. Please try another photo.";
  } else {
    const taxon = topResult.taxon;
    const commonName = taxon?.english_common_name || taxon?.default_name?.name || taxon?.preferred_common_name || taxon?.name;
    const latinName = taxon.name;
    const confidence = topResult.score ? (topResult.score * 100).toFixed(2) : null;
    const taxonImage = taxon.default_photo?.medium_url;

    formattedContent = `### ${commonName}
`;
    formattedContent += `**Scientific Name:** *${latinName}*
`;
    if (confidence) {
      formattedContent += `**Confidence:** ${confidence}%

`;
    } else {
      formattedContent += `
`;
    }
    if (taxonImage) {
      formattedContent += `![Image of ${commonName}](${taxonImage})

`;
    }
  }
  return formattedContent;
}

async function getTextResponse(userMessage, history, systemPrompt) {
  const llmSystemPrompt = systemPrompt || `You are a bird expert. Answer the user's question about birds clearly and concisely. Keep your answers brief unless asked for more detail.`;
  
  const llmHistory = history.map(msg => ({
    role: msg.sender === 'user' ? 'user' : 'assistant',
    content: msg.text
  }));

  const llmRequestBody = {
    model: "meta-llama/llama-4-scout:free",
    messages: [{ role: "system", content: llmSystemPrompt }, ...llmHistory, { role: "user", content: userMessage }]
  };

  const llmResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(llmRequestBody)
  });

  if (!llmResponse.ok) {
    const errorText = await llmResponse.text();
    console.error('OpenRouter API error:', errorText);
    throw new Error('Failed to get response from AI model.');
  }
  
  const llmData = await llmResponse.json();
  return llmData.choices?.[0]?.message?.content || '';
}

async function getCombinedIdentification(imageBuffer, userMessage, history) {
    const iNatResult = await identifyImageWithINat(imageBuffer);
    
    // Check if iNat failed
    if (iNatResult.startsWith("Could not identify")) {
        return iNatResult;
    }

    // Extract common name for the LLM prompt
    const commonNameMatch = iNatResult.match(/### (.*)\n/);
    const commonName = commonNameMatch ? commonNameMatch[1] : "a bird";

    const llmSystemPrompt = `You are a bird expert. A bird has been identified for the user. Your task is to answer the user's follow-up question about this bird. If the user has not asked a specific question, provide a general description based on the user's desired format. Keep your answers concise and to the point.

Desired format:
- common description
- Key visible features (color, shape, size, distinctive marks)`;
    let llmUserPrompt;
    if (userMessage && userMessage.trim().length > 0) {
      llmUserPrompt = `The bird has been identified as ${commonName}. The user has a specific question: "${userMessage}". Please answer it.`;
    } else {
      llmUserPrompt = `Tell me more about the ${commonName}.`;
    }

    const llmResponseText = await getTextResponse(llmUserPrompt, history, llmSystemPrompt);
    
    return `${iNatResult}\n\n---\n\n${llmResponseText}`;
}


module.exports = { identifyImageWithINat, getCombinedIdentification, getTextResponse };