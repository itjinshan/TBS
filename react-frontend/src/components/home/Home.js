import React, { Component } from 'react';
import PropTypes from "prop-types";
import { connect } from "react-redux";

class home extends Component {
    componentDidMount = () => {
        window.scrollTo(0, 0);
    };

    render() {
        return (
            <div>
                Here is home page
            </div>
        )
    }
}

// map props to PropTypes for type checking
home.propTypes = {
    auth: PropTypes.object.isRequired
};

const mapStateToProps = state => ({
    auth: state.auth
});

export default connect(
    mapStateToProps
)(home);