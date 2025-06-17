import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import "./App.css";

const GroceryOffers = () => {
  const [creditCards, setCreditCards] = useState([]);
  const [debitCards, setDebitCards] = useState([]);
  const [premiumCards, setPremiumCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCreditCards, setFilteredCreditCards] = useState([]);
  const [filteredDebitCards, setFilteredDebitCards] = useState([]);
  const [filteredPremiumCards, setFilteredPremiumCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [groceryOffers, setGroceryOffers] = useState([]);
  const [premiumOffers, setPremiumOffers] = useState([]);
  const [noOffersMessage, setNoOffersMessage] = useState("");
  const [isMobile, setIsMobile] = useState(false);

  // Check screen width to detect if it's mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  // Fetch and parse CSV files
  useEffect(() => {
    const fetchAndParseCSV = (filePath) =>
      new Promise((resolve, reject) => {
        Papa.parse(filePath, {
          download: true,
          header: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error),
        });
      });

    const extractCards = (groceryData, premiumData) => {
      const creditCards = new Set();
      const debitCards = new Set();
      const premiumCards = new Set();

      // Extract from grocery offers
      groceryData.forEach((row) => {
        if (row["Applicable Credit Card"]) {
          row["Applicable Credit Card"]
            .split(",")
            .map((card) => card.trim())
            .forEach((card) => creditCards.add(card));
        }
        if (row["Applicable Debit Card"]) {
          row["Applicable Debit Card"]
            .split(",")
            .map((card) => card.trim())
            .forEach((card) => debitCards.add(card));
        }
      });

      // Extract from premium cards - using "Credit Card Name" column
      premiumData.forEach((row) => {
        if (row["Credit Card Name"] && row["Credit Card Name"].trim() !== "") {
          premiumCards.add(row["Credit Card Name"].trim());
        }
      });

      return {
        creditCards: Array.from(creditCards).filter(Boolean),
        debitCards: Array.from(debitCards).filter(Boolean),
        premiumCards: Array.from(premiumCards).filter(Boolean),
      };
    };

    const fetchData = async () => {
      try {
        const [groceryData, premiumData] = await Promise.all([
          fetchAndParseCSV("/Corrected_Grocery_Offers.csv"),
          fetchAndParseCSV("/Credit Card.csv"),
        ]);
        
        const { creditCards, debitCards, premiumCards } = extractCards(groceryData, premiumData);
        setCreditCards(creditCards);
        setDebitCards(debitCards);
        setPremiumCards(premiumCards);
        setFilteredCreditCards(creditCards);
        setFilteredDebitCards(debitCards);
        setFilteredPremiumCards(premiumCards);
        
        console.log("Premium cards loaded:", premiumCards); // Debug log
      } catch (error) {
        console.error("Error fetching or parsing CSV files:", error);
      }
    };

    fetchData();
  }, []);

  // Fetch offers based on selected card
  const fetchOffers = async (card) => {
    const fetchAndParseCSV = (filePath) =>
      new Promise((resolve, reject) => {
        Papa.parse(filePath, {
          download: true,
          header: true,
          complete: (results) => resolve(results.data),
          error: (error) => reject(error),
        });
      });

    const filterGroceryOffers = (data, card) =>
      data.filter(
        (row) =>
          row["Applicable Credit Card"]?.includes(card) ||
          row["Applicable Debit Card"]?.includes(card)
      );

    const filterPremiumOffers = (data, card) =>
      data.filter((row) => 
        row["Credit Card Name"]?.trim() === card
      );

    try {
      const [groceryData, premiumData] = await Promise.all([
        fetchAndParseCSV("/Corrected_Grocery_Offers.csv"),
        fetchAndParseCSV("/Credit Card.csv"),
      ]);
      
      const filteredGroceryOffers = filterGroceryOffers(groceryData, card);
      const filteredPremiumOffers = filterPremiumOffers(premiumData, card);
      
      setGroceryOffers(filteredGroceryOffers);
      setPremiumOffers(filteredPremiumOffers);

      if (filteredGroceryOffers.length === 0 && filteredPremiumOffers.length === 0) {
        setNoOffersMessage("No offers found for this card.");
      } else {
        setNoOffersMessage("");
      }
    } catch (error) {
      console.error("Error fetching or filtering offers:", error);
    }
  };

  // Handle search input
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value === "") {
      setFilteredCreditCards(creditCards);
      setFilteredDebitCards(debitCards);
      setFilteredPremiumCards(premiumCards);
      setNoOffersMessage("");
      setSelectedCard("");
      setGroceryOffers([]);
      setPremiumOffers([]);
      return;
    }

    const matchingCreditCards = creditCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );
    const matchingDebitCards = debitCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );
    const matchingPremiumCards = premiumCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredCreditCards(matchingCreditCards);
    setFilteredDebitCards(matchingDebitCards);
    setFilteredPremiumCards(matchingPremiumCards);

    if (matchingCreditCards.length === 0 && matchingDebitCards.length === 0 && matchingPremiumCards.length === 0) {
      setNoOffersMessage("No offers found for this card.");
    } else {
      setNoOffersMessage("");
    }
  };

  // Handle card selection
  const handleCardSelect = (card) => {
    setSelectedCard(card);
    setSearchTerm(card);
    setFilteredCreditCards([]);
    setFilteredDebitCards([]);
    setFilteredPremiumCards([]);
    fetchOffers(card);
  };

  return (
    <div className="container">
      {/* Centered search and dropdown section */}
      <div className="search-container">
        <div className="search-section">
          <input
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search your credit/debit card..."
            className="search-input"
          />

          {(filteredCreditCards.length > 0 || filteredDebitCards.length > 0 || filteredPremiumCards.length > 0) && (
            <ul className="dropdown-list">
              {filteredCreditCards.length > 0 && (
                <>
                  <li className="dropdown-header">Credit Cards</li>
                  {filteredCreditCards.map((card, index) => (
                    <li
                      key={`credit-${index}`}
                      className="dropdown-item"
                      onClick={() => handleCardSelect(card)}
                    >
                      {card}
                    </li>
                  ))}
                </>
              )}

              {filteredDebitCards.length > 0 && (
                <>
                  <li className="dropdown-header">Debit Cards</li>
                  {filteredDebitCards.map((card, index) => (
                    <li
                      key={`debit-${index}`}
                      className="dropdown-item"
                      onClick={() => handleCardSelect(card)}
                    >
                      {card}
                    </li>
                  ))}
                </>
              )}

              {filteredPremiumCards.length > 0 && (
                <>
                  <li className="dropdown-header">Premium Cards</li>
                  {filteredPremiumCards.map((card, index) => (
                    <li
                      key={`premium-${index}`}
                      className="dropdown-item"
                      onClick={() => handleCardSelect(card)}
                    >
                      {card}
                    </li>
                  ))}
                </>
              )}
            </ul>
          )}
        </div>
      </div>

      {/* Offers display section */}
      {noOffersMessage && (
        <p className="no-offers-message">{noOffersMessage}</p>
      )}

      {selectedCard && !noOffersMessage && (
        <div className="offers-container">
          {/* Regular offers section */}
          {groceryOffers.length > 0 && (
            <>
              <h2 className="offers-heading">Current Offers</h2>
              <div className="offers-grid">
                {groceryOffers.map((offer, index) => (
                  <div key={index} className="offer-card">
                    <h3>Offers on {offer.App}</h3>
                    <p>
                      <strong>Offer:</strong> {offer["Description of the offer"]}
                    </p>
                    <p>
                      <strong>Coupon Code:</strong> {offer["Coupon Code/Link"]}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Permanent offers section */}
          {premiumOffers.length > 0 && (
            <>
              <h2 className="offers-heading">Permanent Offers</h2>
              <div className="offers-grid">
                {premiumOffers.map((offer, index) => (
                  <div key={`premium-${index}`} className="offer-card">
                    <h3>{offer["Credit Card Name"]}</h3>
                    <p>
                      <strong>Grocery/Departmental Store Benefits:</strong>{" "}
                      {offer["Grocery/Departmental Store Benefits"]}
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default GroceryOffers;