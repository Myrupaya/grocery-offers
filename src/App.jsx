import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import "./App.css";

const GroceryOffers = () => {
  const [creditCards, setCreditCards] = useState([]);
  const [debitCards, setDebitCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCreditCards, setFilteredCreditCards] = useState([]);
  const [filteredDebitCards, setFilteredDebitCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [groceryOffers, setGroceryOffers] = useState([]);
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

  // Fetch and parse CSV file
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

    const extractCards = (data) => {
      const creditCards = new Set();
      const debitCards = new Set();

      data.forEach((row) => {
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

      return {
        creditCards: Array.from(creditCards),
        debitCards: Array.from(debitCards),
      };
    };

    const fetchData = async () => {
      try {
        const groceryData = await fetchAndParseCSV("/Corrected_Grocery_Offers.csv");
        const { creditCards, debitCards } = extractCards(groceryData);
        setCreditCards(creditCards);
        setDebitCards(debitCards);
        setFilteredCreditCards(creditCards);
        setFilteredDebitCards(debitCards);
      } catch (error) {
        console.error("Error fetching or parsing CSV file:", error);
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

    const filterOffers = (data, card) =>
      data.filter(
        (row) =>
          row["Applicable Credit Card"]?.includes(card) ||
          row["Applicable Debit Card"]?.includes(card)
      );

    try {
      const groceryData = await fetchAndParseCSV("/Corrected_Grocery_Offers.csv");
      const filteredOffers = filterOffers(groceryData, card);
      setGroceryOffers(filteredOffers);

      if (filteredOffers.length === 0) {
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
      setNoOffersMessage("");
      setSelectedCard("");
      setGroceryOffers([]);
      return;
    }

    const matchingCreditCards = creditCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );
    const matchingDebitCards = debitCards.filter((card) =>
      card.toLowerCase().includes(value.toLowerCase())
    );

    setFilteredCreditCards(matchingCreditCards);
    setFilteredDebitCards(matchingDebitCards);

    if (matchingCreditCards.length === 0 && matchingDebitCards.length === 0) {
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
    fetchOffers(card);
  };

  return (
    <div className="container">
      <div className="title-box">
        <h1>Grocery Offers</h1>
      </div>

      <div className="content-row">
        <div className="text-section">
          <h2>Find the Best Grocery Discounts</h2>
          <p>
            Discover amazing discounts and cashback offers on groceries 
            using your credit or debit cards. Search for your card to see 
            available offers from various stores.
          </p>
        </div>
        <div className="image-section">
          <img 
            src="https://via.placeholder.com/400x300?text=Grocery+Items" 
            alt="Grocery items" 
            className="grocery-image"
          />
        </div>
      </div>

      <div className="main">
        <div className="search-container">
          <div className="search-dropdown">
            <input
              id="creditCardSearch"
              type="text"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search your card..."
              className="search-input"
            />

            {(filteredCreditCards.length > 0 || filteredDebitCards.length > 0) && (
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
              </ul>
            )}
          </div>
        </div>

        {noOffersMessage && (
          <div className="message-box">
            <p>{noOffersMessage}</p>
          </div>
        )}

        {selectedCard && !noOffersMessage && (
          <div className="offers-grid">
            {groceryOffers.map((offer, index) => (
              <div key={index} className="offer-card">
                <h3>{offer.App}</h3>
                <div className="offer-details">
                  <p><span className="detail-label">Offer:</span> {offer["Description of the offer"]}</p>
                  {offer["Coupon Code/Link"] && (
                    <p><span className="detail-label">Code:</span> {offer["Coupon Code/Link"]}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GroceryOffers;