// Function to clean AI response by removing headings and formatting


function cleanAIResponse(response) {
    if (!response || typeof response !== 'string') {
      return response;
    }
  
    let cleanedResponse = response;
  
    // Remove markdown headings (# ## ### #### ##### ######)
    cleanedResponse = cleanedResponse.replace(/^#{1,6}\s+.*$/gm, '');
    
    // Remove markdown bold/italic formatting (**text** or *text*)
    cleanedResponse = cleanedResponse.replace(/\*\*(.*?)\*\*/g, '$1');
    cleanedResponse = cleanedResponse.replace(/\*(.*?)\*/g, '$1');
    
    // Remove markdown code blocks (```code```)
    cleanedResponse = cleanedResponse.replace(/```[\s\S]*?```/g, '');
    
    
    // Clean up the response
    cleanedResponse = cleanedResponse.trim();
    
    return cleanedResponse;
  }


  export default { cleanAIResponse };