import { useNavigate } from "react-router-dom";
import React from "react";

function withRouter(Component) {
  return function WrappedComponent(props) {
    const navigate = useNavigate();
    return <Component {...props} navigate={navigate} />;
  };
}

export default withRouter;