import React, { useState, useEffect } from "react";
import Papa from "papaparse";
import "./App.css"; // Reuse the same CSS file

const MovieOffers = () => {
  const [creditCards, setCreditCards] = useState([]);
  const [debitCards, setDebitCards] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredCreditCards, setFilteredCreditCards] = useState([]);
  const [filteredDebitCards, setFilteredDebitCards] = useState([]);
  const [selectedCard, setSelectedCard] = useState("");
  const [movieOffers, setMovieOffers] = useState([]);
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
        const movieData = await fetchAndParseCSV("/Corrected_Movie_Offers.csv");
        const { creditCards, debitCards } = extractCards(movieData);
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
      const movieData = await fetchAndParseCSV("/Corrected_Movie_Offers.csv");
      const filteredOffers = filterOffers(movieData, card);
      setMovieOffers(filteredOffers);

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
      setMovieOffers([]);
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
        <h1>Movie Offers</h1>
      </div>

      <div className="content-row">
        <div className="text-section">
          <h2>Find the Best Movie Ticket Offers</h2>
          <p>
            Discover amazing discounts and cashback offers on movie tickets 
            using your credit or debit cards. Search for your card to see 
            available offers from various platforms. Save money on your next 
            movie outing with these exclusive deals!
          </p>
        </div>
        <div className="image-section">
          <img 
            src="https://via.placeholder.com/400x300?text=Movie+Tickets" 
            alt="Movie tickets" 
            className="movie-image"
          />
        </div>
      </div>

      <div className="main">
        <div className="search-dropdown">
          <input
            id="creditCardSearch"
            type="text"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Type to search..."
            className="search-input"
          />

          {(filteredCreditCards.length > 0 || filteredDebitCards.length > 0) && (
            <ul className="dropdown-list">
              {filteredCreditCards.length > 0 && (
                <>
                  <li style={{ fontWeight: "bold", padding: "10px", backgroundColor: "#f0f0f0" }}>
                    Credit Cards
                  </li>
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
                  <li style={{ fontWeight: "bold", padding: "10px", backgroundColor: "#f0f0f0" }}>
                    Debit Cards
                  </li>
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

        {noOffersMessage && (
          <p className="no-offers-message">{noOffersMessage}</p>
        )}

        {selectedCard && !noOffersMessage && (
          <div className="offers-section">
            {movieOffers.length > 0 && (
              <div>
                {movieOffers.map((offer, index) => (
                  <div key={index} className="offers-container">
                    <h2 className="offers-heading">
                      <strong>Offers on</strong> {offer.App}
                    </h2>
                    <div className="offers-cards-container">
                      <div className="offer-card">
                        <p>
                          <strong>Offer:</strong> {offer["Description of the offer"]}
                        </p>
                        <p>
                          <strong>Coupon Code:</strong> {offer["Coupon Code/Link"]}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MovieOffers;